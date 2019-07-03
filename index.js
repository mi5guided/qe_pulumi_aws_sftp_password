// ****************************************************************************
// Main Entry Point for this Pulumi Project
//   Segemented out 3 modules: sFTP service, Lambda Definition, and API Gateway
// ****************************************************************************

"use strict";
const awsSftp = require("./sftp");
const awsUserPoolFunc = require("./userpoolfunc.js");
const awsUserPoolApi = require("./userpoolapi.js");
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

// Default program values
let progConfig = {
  "useCustomUserPool": true,
  "prefix": "sxfs",
  // value taken from Date.now(), except we need a reproducible suffix
  "suffix": "-" + (1561806534970 & 0x00FFFF).toString(16)
};
async function syncExecution() {
  let keyMaterial;
  const sftpUsers = [{ name: "userxyz", pw: "one", keyName: "userxyz-keypair.pem" }];

  try {
    for (let i = 0; i < sftpUsers.length; i++) {
      // check to see if we have the user keys; if not, create them
      if (fs.existsSync("./" + sftpUsers[i].keyName + ".pub") === false) {
        const { stdout, stderr } = await exec('ssh-keygen -f ' + sftpUsers[i].keyName);
      }
      // Read key material
      sftpUsers[i].keyMaterial = fs.readFileSync("./" + sftpUsers[i].keyName + ".pub", "utf8");
    }

    if (progConfig.useCustomUserPool) {
      // Define and Deploy Custom User Pool Lambda function and dummy user
      var userPoolFuncParams = {
        "sftpUserList": sftpUsers,
        "useCustomUserPool": progConfig.useCustomUserPool,
        "bucketName": "user-home" + progConfig.suffix,
        "prefix": progConfig.prefix,
        "suffix": progConfig.suffix
      };
      awsUserPoolFunc.ddStart(userPoolFuncParams);

      // Define and Deploy Custom User API Gateway
      var userPoolApiParams = {
        "bucketName": "user-home" + progConfig.suffix,
        "prefix": progConfig.prefix,
        "suffix": progConfig.suffix
      };
      awsUserPoolApi.ddStart(userPoolApiParams);
    }

    // Define and Deploy sFTP Transfer Service
    var sftpParams = {
      "sftpUserList": sftpUsers,
      "useCustomUserPool": progConfig.useCustomUserPool,
      "bucketName": "user-home" + progConfig.suffix,
      "logGroup": "sftp" + progConfig.suffix,
      "prefix": progConfig.prefix,
      "suffix": progConfig.suffix
    };
    awsSftp.ddStart(sftpParams);
  } catch (err) {
    console.error(err);
  }
}

syncExecution();