const express    = require('express'),
      app        = express(),
      http       = require('http').Server(app),
      cors       = require('cors'),
      bodyParser = require("body-parser"),
      path       = require('path'),
      moment     = require('moment'); 
      mysql      = require('mysql');
const AWS = require('aws-sdk');
AWS.config.update({accessKeyId: 'AKIAJIOEWEUWILDXYKPQ', secretAccessKey: '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'});
AWS.config.update({region: 'us-west-2'});
const s3 = new AWS.S3();
let connectionRead, connectionWrite;
let res;
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors())
app.use(express.static(path.join(__dirname, '../dist')));
app.use("/", express.static(__dirname + "/"));


connectionRead = mysql.createConnection({
  host     : 'agiletestware.cni62heuz5ld.us-west-2.rds.amazonaws.com',
  user     : 'readonly',
  password : '!yX<9J~e',
  database : 'license4jdb'
});

connectionWrite = mysql.createConnection({
  host     : 'licensetool.cukwihlqrtiq.us-east-1.rds.amazonaws.com',
  user     : 'agiletestware82',
  password : 'Goliath1!',
  database : 'licensetool'
});

connectionRead.connect(function(err) {
  if (err) throw err;
  console.log("Connected Readonly Database!");  
});

connectionWrite.connect(function(err) {
  if (err) throw err;
  console.log("Connected Writeable Database!");  
});

// Desktop requests
app.get('/', function(req, res) {    
    res.sendFile(path.resolve(__dirname, '../dist/index.html')); 
});

app.get('/importLicenseData', function(req, res) {       
  this.res = res;
  getMaxID();      
});
app.options('/uploadFile', function(req, res) {        
  res.header('Access-Control-Allow-Origin', 'http://localhost:8081');  
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS, HEAD');
  res.send();  
});
app.put('/uploadFile', function(req, res) {
  let fileName = "test.jpg";  
  const myBucket = 'license-tool'  
  const signedUrlExpireSeconds = 60 * 5

  const url = s3.getSignedUrl('getObject', {
      Bucket: myBucket,
      Key: fileName,
      Expires: signedUrlExpireSeconds
  })
  res.send({'url': url});
  console.log(url);         
});

app.get('/getRecords/:filterCondition/:sortCondition', function(req, res) { 
  res.header('Access-Control-Allow-Origin', 'http://localhost:8081');  
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS, HEAD');     
  let filter = JSON.parse(req.params.filterCondition);  
  let sort = JSON.parse(req.params.sortCondition);    
  let sql = "SELECT * FROM licenses";
  if(filter != null) {
    sql += " where ";  
    if(filter.products.length > 0)
      sql += "productName in ('" + filter.products.join("','") + "') and ";  
    if(filter.licenseType.length > 0)
      sql += "licenseType in ('" + filter.licenseType.join("','") + "') and ";
    if(filter.customerStatus.length > 0)
      sql += "customerStatus in ('" + filter.customerStatus.join("','") + "') and ";
    if(!filter.archive)
      sql += "licenseState = 'active' and ";
    sql += "dealValue >= " + filter.minDeal + " and dealValue <= " + filter.maxDeal;
  }  
  sql += " ORDER BY " + sort.field + " " + sort.order;  
  connectionWrite.query(sql, function(err, result) {
    if(err) {      
      console.log("Error");
      return;
    }
    const today = moment(new Date());
    result.forEach(function(item, index){
      const issueDate = moment(item.issueDate);
      const expireDate = moment(item.expireDate);
      item.accountsPayable = item.accountsPayable != null ? item.accountsPayable.toString('binary') : "";
      item.dealNotes = item.dealNotes != null ? item.dealNotes.toString('binary') : "";
      item.importantNotes = item.importantNotes != null ? item.importantNotes.toString('binary') : "";      
      item.issueDate = issueDate.format("YYYY-MM-DD");
      item.expireDate = expireDate.format("YYYY-MM-DD");

      var duration = moment.duration(expireDate.diff(today)).asDays();
      if(duration < 0)
        item.expireState = 0;
      else if(duration <= 30)
        item.expireState = 1;
      else item.expireState = 2;      
      console.log(duration);
    });        
    res.send(result);
  });  
});

app.options('/updateRecord', function(req, res) {        
  res.header('Access-Control-Allow-Origin', 'http://localhost:8081');
  //res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS, HEAD');
  res.send();  
});

app.put('/updateRecord', function(req, res) {      
  let data = req.body;
  let sql = "update licenses set userCompany = '" + data.userCompany + "', ";
  sql += "licenseType = '" + data.licenseType + "', ";
  sql += "dealValue = '" + data.dealValue + "', ";
  sql += "userFullName = '" + data.userFullName + "', ";
  sql += "userEMail = '" + data.userEMail + "', ";
  sql += "licenseURL = '" + data.licenseURL + "', ";
  sql += "freshsalesURL = '" + data.freshsalesURL + "', ";
  sql += "customerStatus = '" + data.customerStatus + "', ";
  sql += "licenseState = '" + data.licenseState + "', ";
  sql += "accountsPayable = '" + data.accountsPayable + "', ";
  sql += "dealNotes = '" + data.dealNotes + "', ";
  sql += "importantNotes = '" + data.importantNotes + "' where license_id = " + data.license_id;
  connectionWrite.query(sql, function (err, result) {
    if (err) {
      res.send({'error': true});
      return;
    }
    res.send({'error': false});
  });  
});

app.options('/updateLicenseState', function(req, res) {        
  res.header('Access-Control-Allow-Origin', 'http://localhost:8081');  
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS, HEAD');
  res.send();  
});

app.put('/updateLicenseState', function(req, res) {  
  let data = req.body;
  let sql = "update licenses set licenseState = '" + data.licenseState + "' where license_id = " + data.license_id;
  connectionWrite.query(sql, function (err, result) {
    if (err) {
      res.send({'error': true});
      return;
    }
    res.send({'error': false});
  });
});
app.delete('/deleteSQLData', function(req, res) {    
  let sql = "TRUNCATE licenses";
  connectionWrite.query(sql, function (err, result) {
    if (err) {
      res.send({'error': true});
      return;
    }
    res.send({'error': false});
  });
});
function getMaxID() {
  connectionWrite.query("SELECT MAX(license_id) as licenseID from licenses", function(err, result) {
    if (err) throw err;      
    var maxID = 0; 
    if(result[0].licenseID != null)
      maxID = result[0].licenseID;
    getNewRecords(maxID, res);    
  });
}

function getNewRecords(maxID) {
  var self = this;  
  connectionRead.query("SELECT L.licenseID as license_id, L.userFullName, L.userEMail, L.userCompany, L.userRegisteredTo, L.validityPeriod, P.productName FROM licenses as L JOIN products as P on P.productid = L.productid where L.licenseID > " + maxID + " order by L.licenseID", function(err, result) {
    if (err) throw err; 
    var newRecords = [];
    result.forEach(function(item){
      var record = new Array();
      if(item.productName == "eggplant-alm" || item.productName == "eggplant") {
        item.licenseType = "eggplant";
        item.productName = "eggplant";
        if(item.userFullName == null || item.userFullName == '')
          item.userFullName = 'Eggplant';
        if(item.userEMail == null || item.userEMail == '')
          item.userEMail = 'no-reply@eggplant.com';
        if(item.userCompany == null || item.userCompany == '')
          item.userCompany = 'Testplant';
      } else if(item.userRegisteredTo == "evaluation" || item.userRegisteredTo == "Evaluation")
       item.licenseType = "evaluation";
      else if(item.userRegisteredTo == "paid" || item.userRegisteredTo == "Paid")
        item.licenseType = "basic";
      else if(item.userRegisteredTo == "enterprise" || item.userRegisteredTo == "Enterprise")
        item.licenseType = "enterprise";
      else item.licenseType = "";
      let issueDate = new Date(item.license_id);            
      issueDate = moment(issueDate).format("YYYY-MM-DD");
      
      let expireDate = new Date(issueDate);
      expireDate.setDate(expireDate.getDate() + item.validityPeriod);
      expireDate = moment(expireDate).format("YYYY-MM-DD");
      item.issueDate = issueDate;
      item.expireDate = expireDate;

      var keys = Object.keys(item);      
      keys.forEach(function(key){
        record.push(item[key]);
      });                  
      newRecords.push(record);
    })
    if(newRecords.length == 0) {
      self.res.send({'error': false, 'numbers': 0});
      return;
    }
    var sql = "INSERT INTO licenses (license_id, userFullName, userEMail, userCompany, userRegisteredTo, validityPeriod, productName, licenseType, issueDate, expireDate) VALUES ?";
    connectionWrite.query(sql, [newRecords], function (err, result) {      
      if (err) {
        self.res.send({'error': true});
        return;
      }
      self.res.send({'error': false, 'numbers': result.affectedRows});
      console.log("Number of records inserted: " + result.affectedRows);      
    });
  }); 
}

function fetchRecords() {
  var self = this; 
  connectionWrite.query("SELECT * FROM licenses", function(err, result) {
    if (err) {
      console.log(this.sql);
      return;
    }  
    
    result.forEach(function(item, index){
      item.accountsPayable = item.accountsPayable != null ? item.accountsPayable.toString('binary') : "";
      item.dealNotes = item.dealNotes != null ? item.dealNotes.toString('binary') : "";
      item.importantNotes = item.importantNotes != null ? item.importantNotes.toString('binary') : "";      
    });    
    self.res.header('Access-Control-Allow-Origin', 'http://localhost:8081');
    self.res.header('Access-Control-Allow-Credentials', true);
    self.res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS, HEAD');
    
  });
}

http.listen(8080, function(){
	console.log("Connected & Listen to port 8080");
});
