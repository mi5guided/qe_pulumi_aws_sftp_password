
up: lambdacode.zip simplelambda.zip
	pulumi up

lambdacode.zip: lambdacode.py
	zip lambdacode.zip lambdacode.py

simplelambda.zip: simplelambda.js
	zip simplelambda.zip simplelambda.js

down: 
	pulumi destroy
	aws --region us-east-2 --profile 416768527988 secretsmanager delete-secret --secret-id 'SFTP/userxyz' --force-delete-without-recovery

out:
	pulumi stack output

preview:
	time node preTest.js

access-test:
	aws --profile pulumitargetacct s3 ls
