import json,os,boto3
from datetime import datetime
d=boto3.resource('dynamodb').Table(os.environ.get('TABLE','EmergencyMessages'))
s=boto3.client('sns')
a=os.environ.get('SNS_ARN','')
def lambda_handler(e,c):
    b=json.loads(e['body'])if'body'in e else e
    if not b.get('text'):return{'statusCode':400,'body':json.dumps({'error':'Text required'})}
    i=b.get('id')or str(int(datetime.now().timestamp()*1000))
    it={'id':i,'text':b['text'].strip(),'location':b.get('location','Unknown'),'timestamp':b.get('timestamp',datetime.utcnow().isoformat()),'synced_at':datetime.utcnow().isoformat()}
    d.put_item(Item=it)
    if a:
        try:s.publish(TopicArn=a,Subject='🚨 EMERGENCY',Message=json.dumps(it))
        except:pass
    return{'statusCode':200,'body':json.dumps({'success':True,'id':i})}
