import express from 'express';
import { db } from '../Database/dbindex.js';
const router = express.Router();
var fenixid = '208016830491525120';

//? Calling db via pg-promise
// db.any("SELECT * FROM currency WHERE userid = $1", [fenixid]).then(dbData => { 
//     console.log(dbData[0].userid);
//     })
//     .catch(error => {
//         console.log(error);
//     })

//? Express.js w/ Promise Router
router.get('/', (req, res)  => {
    db.any("SELECT * FROM currency WHERE userid = $1", [fenixid]).then(dbData => { 
    console.log(dbData[0].userid);
    res.json(dbData[0].userid)
    })
    .catch(error => {
        console.log(error);
    })
})

export { router };

