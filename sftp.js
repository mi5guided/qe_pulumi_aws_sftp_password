"use strict";
const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");

// value taken from Date.now(), except we need a reproducible suffix
const projSuffix = "-" + (1561806534970 & 0x00FFFF).toString(16);

// Default module values
let modConfig = {
  "sftpUserList": [],
  "logGroup": "sftp" + projSuffix
};
let rsrcPulumiSftp = {};

// ****************************************************************************
// Configure module
// ****************************************************************************
function setModuleConfig(parm) {
  let valList = Object.keys(parm);
  valList.forEach((x) => {
    modConfig[x] = parm[x];
  });
}

// ****************************************************************************
// Create resources
// ****************************************************************************
function rsrcPulumiCreate() {
  // Create S3 bucket that will be the home directory for everyone
  rsrcPulumiSftp.homeBucket = new aws.s3.Bucket("user-home" + projSuffix);

  // Create the sFTP service, itself
  rsrcPulumiSftp.sftpLoggingRole = new aws.iam.Role("sftpLoggingRole", {
    assumeRolePolicy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Effect": "Allow",
		"Principal": {
			"Service": "transfer.amazonaws.com"
		},
		"Action": "sts:AssumeRole"
		}
	]
}
`,
  });

  rsrcPulumiSftp.sftpLoggingRolePolicy = new aws.iam.RolePolicy("sftpLoggingRolePolicy", {
    policy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Sid": "AllowFullAccesstoCloudWatchLogs",
		"Effect": "Allow",
		"Action": [
			"logs:*"
		],
		"Resource": "*"
		}
	]
}
`,
    role: rsrcPulumiSftp.sftpLoggingRole.id,
  });

  rsrcPulumiSftp.sftpServer = new aws.transfer.Server("sftpServer", {
    identityProviderType: "SERVICE_MANAGED",
    loggingRole: rsrcPulumiSftp.sftpLoggingRole.arn,
    tags: {
      ENV: "dev",
      NAME: "basic sftp server",
    },
  });

  // start populating the users
  rsrcPulumiSftp.sftpAccessRole = new aws.iam.Role("sftpAccessRole", {
    assumeRolePolicy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
		"Effect": "Allow",
		"Principal": {
			"Service": "transfer.amazonaws.com"
		},
		"Action": "sts:AssumeRole"
		}
	]
}
`,
  });

  rsrcPulumiSftp.sftpAccessRolePolicy = new aws.iam.RolePolicy("sftpAccessRolePolicy", {
    policy: `{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowFullAccesstoS3",
			"Effect": "Allow",
			"Action": [
				"s3:*"
			],
			"Resource": "*"
		}
	]
}
`,
    role: rsrcPulumiSftp.sftpAccessRole.id,
  });

  modConfig.sftpUserList.forEach((x) => {
    rsrcPulumiSftp[x.name] = new aws.transfer.User(x.name, {
      role: rsrcPulumiSftp.sftpAccessRole.arn,
      serverId: rsrcPulumiSftp.sftpServer.id,
      tags: {
        NAME: x.name
      },
      userName: x.name
    });
    rsrcPulumiSftp[x.name + "_key"] = new aws.transfer.SshKey(x.name + "_key", {
      body: x.keyName,
      serverId: rsrcPulumiSftp.sftpServer.id,
      userName: rsrcPulumiSftp[x.name].userName
    });
  });

}

// ****************************************************************************
// Custom output
// ****************************************************************************
function postDeploy() {
  pulumi.all([
    rsrcPulumiSftp.sftpServer.id,
    rsrcPulumiSftp.sftpServer.endpoint
  ]).apply(([x, y]) => {
    console.log("sftp Info:", x);
    console.log("sftp Endpt:", y);
  });
}

// ****************************************************************************
// API into this module
// ****************************************************************************
function ddStart(params) {
  setModuleConfig(params);
  rsrcPulumiCreate();
  postDeploy();
}

module.exports.ddStart = ddStart;
module.exports.pulumiResources = rsrcPulumiSftp;
