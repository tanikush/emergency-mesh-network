import json
import os
import boto3
from datetime import datetime
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

# Get table name from environment variable or use default
TABLE_NAME = os.environ.get('DYNAMODB_TABLE', 'EmergencyMessages')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    AWS Lambda function to handle emergency messages.
    
    Expected JSON payload:
    {
        "id": "1234567890",
        "text": "Emergency description",
        "location": "Village name / coordinates",
        "timestamp": "2026-04-21T21:00:00Z",
        "synced": false
    }
    
    Returns:
        {
            "statusCode": 200,
            "body": "{\"success\": true, \"id\": \"1234567890\"}"
        }
    """
    try:
        logger.info(f"Received emergency message event: {event}")

        # Parse request body
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event  # Direct invocation

        # Validate required fields
        if 'text' not in body or not body['text'].strip():
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Message text is required',
                    'field': 'text'
                })
            }

        # Generate unique ID if not provided
        message_id = body.get('id') or str(int(datetime.now().timestamp() * 1000))

        # Prepare DynamoDB item
        item = {
            'id': message_id,
            'text': body['text'].strip(),
            'location': body.get('location', 'Unknown').strip(),
            'timestamp': body.get('timestamp', datetime.utcnow().isoformat()),
            'synced_at': datetime.utcnow().isoformat(),
            'source': 'offline_mesh_network'
        }

        # Save to DynamoDB
        table.put_item(Item=item)
        logger.info(f"Message saved to DynamoDB: {message_id}")

        # Send SNS alert (if configured)
        if SNS_TOPIC_ARN:
            try:
                sns_message = f"""
🚨 EMERGENCY ALERT RECEIVED

Message: {item['text']}
Location: {item['location']}
Time: {item['timestamp']}
Message ID: {item['id']}

--- Automated alert from Emergency Mesh Network System ---
                """.strip()

                sns.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject='🚨 EMERGENCY ALERT',
                    Message=sns_message
                )
                logger.info(f"SNS alert sent for message: {message_id}")
            except Exception as sns_error:
                logger.error(f"SNS publish failed: {sns_error}")
                # Don't fail the request if SNS fails

        # Return success
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'id': message_id,
                'message': 'Emergency alert received and processed',
                'timestamp': item['synced_at']
            })
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Invalid JSON in request body'
            })
        }
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            })
        }
