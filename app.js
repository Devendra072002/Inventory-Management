const express = require("express");
const bodyParser = require("body-parser");
const redis = require("redis");
const ejs = require("ejs");
const { keys } = require("lodash");

const app = express();

var SalesArray = [];
var PurchasesArray = [];
var StocksArray = [];



app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));


async function addKeyValue(key, obj) {
    try {
        const added = await client.HSET(key, obj)
        // console.log(added)
        const char1 = key.substr(0, 1);
        if (char1 === 'P') {
            PurchasesArray.push(await getKeyValue(key))
        } else if (char1 === 'S') {
            SalesArray.push(await getKeyValue(key))
        } else if (char1 === 'I') {
            StocksArray.push(await getKeyValue(key))
        }
    } catch (err) {
        console.log(err)
    }
}


async function getKeyValue(key) {
    try {
        const getValue = await client.HGETALL(key);
        const char = key.substr(0, 1);
        if (char === 'P') {
            getValue.id = key.substr(9);
        } else if (char === 'S') {
            getValue.id = key.substr(5);
        } else if (char === 'I') {
            getValue.id = key.substr(10);
        } else {
            getValue.id = key;
        }
        return getValue;
        // console.log(getValue)
    } catch (err) {
        console.log(err)
    }
}

async function existsOrNot(key) {
    try {
        const exists = await client.EXISTS(key);
        return exists;
    } catch (err) {
        console.log(err)
    }
}

async function updateValue(key, field, value) {
    try {
        const newValue = await client.HSET(key, field, value);
        console.log(newValue);
    } catch (err) {
        console.log(err)
    }
}

async function getKeysOfSameType(pattern) {
    try {
        const Keys = await client.KEYS(`${pattern}*`);
        return Keys;
    } catch (err) {
        console.log(err)
    }
}

const client = redis.createClient();
client.on('error', (err) => console.log('Redis Client Error', err));
client.on('connect', function () {
    console.log("Connected to redis server");
});


(async () => {
    await client.connect();
    let temp1 = await getKeysOfSameType('Inventory:');
    console.log(temp1);
    for (let index = 0; index < temp1.length; index++) {
        StocksArray.push(await getKeyValue(temp1[index]));

    }
    console.log(StocksArray);
    let temp2 = await getKeysOfSameType('Sale:');
    console.log(temp2);
    for (let index = 0; index < temp2.length; index++) {
        StocksArray.push(await getKeyValue(temp2[index]));

    }
    let temp3 = await getKeysOfSameType('Purchase:');
    console.log(temp3);
    for (let index = 0; index < temp3.length; index++) {
        StocksArray.push(await getKeyValue(temp3[index]));

    }
})();


async function addLeftStockEntry(itemname, type, qty, rate) {
    if (type === "Purchase") {
        let temp = await existsOrNot("Inventory:" + itemname);
        console.log(temp);
        if (temp == 1) {
            console.log("Updating Data to Inventory due to purchase");
            updateValue("Inventory:" + itemname, "STOCK", parseInt(qty));
        }
        else {
            let tempObj = {
                STOCK: parseInt(qty),
                SOLD_QUANTITY: parseInt('0'),
                RATE: parseInt(rate)
            };
            console.log("Adding Data to Inventory");

            addKeyValue("Inventory:" + itemname, tempObj);
        }
    }
    else {
        console.log("Updating Data to Inventory due to sales");

        let temp = await getKeyValue("Inventory:" + itemname);
        console.log(temp);

        await updateValue("Inventory:" + itemname, "STOCK", parseInt(temp.STOCK) - parseInt(qty));
        await updateValue("Inventory:" + itemname, "SOLD_QUANTITY", parseInt(temp.SOLD_QUANTITY) + parseInt(qty));
        let temp2 = await getKeysOfSameType('Inventory:');
        console.log(temp2);
        StocksArray = [];
        for (let index = 0; index < temp2.length; index++) {
            StocksArray.push(await getKeyValue(temp2[index]));

        }


    }
}
function addSalesEntry(billNo, date, itemname, qty, rate) {

    let tempObj = {
        DATE: date,
        ITEM_NAME: itemname,
        QUANTITY: qty,
        RATE: rate
    };
    console.log("Adding Data to Sales");
    addKeyValue("Sale:" + billNo, tempObj);
}

function addPurchaseEntry(billNo, date, itemname, qty, rate) {

    let tempObj = {
        DATE: date,
        ITEM_NAME: itemname,
        QUANTITY: qty,
        RATE: rate
    };
    console.log("Adding Data to Purchase");
    addKeyValue("Purchase:" + billNo, tempObj);

}
function addBillEntry(billNo, date, type, name, itemname, qty, rate) {

    let tempObj = {
        DATE: date,
        TYPE: type,
        NAME: name,
        ITEM_NAME: itemname,
        QUANTITY: qty,
        RATE: rate
    };

    console.log("Adding Data to Bill");
    addKeyValue(billNo, tempObj);

    if (type === "Purchase") {
        console.log("xx xx xx qty ", qty)
        addPurchaseEntry(billNo, date, itemname, qty, rate);
    } else {
        addSalesEntry(billNo, date, itemname, qty, rate);
    }
    addLeftStockEntry(itemname, type, qty, rate);
}



app.get("/", function (req, res) {

    // let temp3=await getKeysOfSameType('Inventory:');


    res.render("index");

})
app.get("/bill", function (req,res) {
    res.render("home", { Inventory: StocksArray });
})

app.post("/bill", function (req, res) {

    // console.log(req.body.Qty);
    console.log(req.body.ItemName);
    // console.log("New item Name ",req.body.NewItemName);
    if (req.body.NewItemName === "")
        addBillEntry(req.body.billNo, req.body.date, req.body.type, req.body.Name, req.body.ItemName, parseInt(req.body.Qty), parseInt(req.body.Rate));
    else
        addBillEntry(req.body.billNo, req.body.date, req.body.type, req.body.Name, req.body.NewItemName, parseInt(req.body.Qty), parseInt(req.body.Rate));
    res.redirect("/");
})

app.get("/purchase", async (req, res) => {

    res.render("page2", { Purchases: PurchasesArray });
})

app.get("/sales", async (req, res) => {

    res.render("page1", { Sales: SalesArray });
})
app.get("/stock", async (req, res) => {

    res.render("page3", { Stocks: StocksArray });
})


app.listen(3000, function () {
    console.log("Server started running at port 3000.");
})






