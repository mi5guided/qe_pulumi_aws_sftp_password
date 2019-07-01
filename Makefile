
up: lambdacode.zip
	pulumi up

lambdacode.zip: lambdacode.py
	zip lambdacode.zip lambdacode.py

down: 
	pulumi destroy

out:
	pulumi stack output

preview:
	time node preTest.js

access-test:
	aws --profile pulumitargetacct s3 ls
