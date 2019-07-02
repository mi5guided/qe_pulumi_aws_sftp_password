// ****************************************************************************
// Main Entry Point for this Pulumi Project
//   Segemented out 2 modules: Networking and EC2 instance.
//   Looking into the promise of better modules
// ****************************************************************************

"use strict";
const awsSftp = require("./sftp");
const awsUserPool = require("./userpool.js")
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
  const sftpUsers = [
    { name: "user1", pw: "PW!123abc", keyName: "user1-keypair.pem" },
    { name: "user2", pw: "PW!123abc", keyName: "user2-keypair.pem" },
    { name: "user3", pw: "PW!123abc", keyName: "user3-keypair.pem" },
  ];
  try {
    // check to see if we have all the user keys; if not, create them
    sftpUsers.forEach(async function (user) {
      if (fs.existsSync("./" + user.keyName + ".pub") === false) {
        const { stdout, stderr } = await exec('ssh-keygen -f ' + user.keyName);
      }
      // Read key material
      user.keyMaterial = fs.readFileSync("./" + user.keyName + ".pub", "utf8");
    });

    if (progConfig.useCustomUserPool) {
      // Define and Deploy Custom User Pool
      var userPoolParams = {
        "sftpUserList": sftpUsers,
        "useCustomUserPool": progConfig.useCustomUserPool,
        "bucketName": "user-home" + progConfig.suffix,
        "prefix": progConfig.prefix,
        "suffix": progConfig.suffix
      };
      awsUserPool.ddStart(userPoolParams);
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