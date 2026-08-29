import admin from 'firebase-admin';

// Initialize Firebase Admin SDK with Exact Service Account Credentials
if (!admin.apps.length) {
    try {
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID || "iskcon-bhuvaikuntha",
            private_key: process.env.FIREBASE_PRIVATE_KEY 
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
                : "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLRhHwp3HNjD12\nHxRa1rvZAmq8oABEzGpWFSGGy95vkNTedOS9KyRRaCUqY78S+cRXaJLMRceijucG\nbFOLMvFc7fxHAz/8fNIihv/iKa9qZxcNqZCuze25mdBlvveJOqtXUdYSw94D61Xa\nlcDyFZbtfvWt5UpRKUgMwiOWlqSN56agw4myIfwqoeFsIIYItNWnHPu7QF9rIhli\nuMVDkOjLmG7B7jocJlNat1WQater9s6YAemufIA1Tb2JGULZ5s1zKiFkyHx/JxDX\n+gQh86eW047ORBOP9Cqm4ISEE2k95bY+B3qxKerhqTRiRqUJWu9zwRrD7C7r6D/q\nOGmsXL/9AgMBAAECggEAIM3QyNm43Z9HbufSmNtFCt8fOwwGJxQnB/fWhoKhhbcl\nhzXtkRKkhIeuUcIxnH4Wv7VmVVVgg30Uzt5N+C2TMnhMiWg+nABHyB8prcWk46K5\n33BRI0ij19s4/KZ+G5UOgCO6jKIz0sWYgBNBRUATMIYX30Wcwe7LzBVLeXqbmTOy\nromsCPjUDVvuB0LjV5FfbTqyBTCmptzQ8ZoGK9wdjLyuLG0QiQx06RNtC/lj5xEV\nvBhM8mU1COytmQrp8tLS4OnGlm/ClSPsesCTR9lgPP6MwED2iLsTx5QNio3TQAYR\nMCeH7qBZgq76PDMXdzvxG4tFiUd32CT+3ia5o2QJWQKBgQDr9MOEmSKFwaRZmXAO\nHxvK3C75ioPmAXuk59bsNTEjTaooZ+q7aIPuZFCSN2W/Z/uDqqTV+CCFZzA19o5G\nT8/I12i8OSXCC0zkbyU3YZHXie+LCsGgnpkkvgDRrqFbFjVWnUlPlRb1FFJpgxaX\nWrV5Flo7F+ztZ2JLiY7aXEb02QKBgQDcipOGRWliQTjAUb6MGcXk/N/IL3kxmgZo\ntMgip6DX3HVgz7SfkEPFcxktLNjTlZuaMd6S3QqfKs3NoQRvqNeQtt+lRdE2wrmD\nAVvdKIuWtiBViJbHyhLr8iLoS1u04L3xBFkPr/wuBhzRJha/vV2FuS9L89aEACGA\nuME80ZvdxQKBgDOeQxuB6KR8PTkAsRvVwF27l2ct3zb1AhiMQ18/L7W6aswWF6rR\n7XK8bUffaJnb5JDkRtUsR+kHLuvPOUa2dQ1J2na6xcDSegrLKcgYxy/w0/+F5d/+\nciAwlLtKSbBEhnyhQgVv5yrMPE8qx0lrJaIMusaMsF8rK7y8pgys/TTZAoGBAILg\nieOo1X1Fj1QyLo4dzV6y4mp+IcHZ0evZPNuz9rOjVNT67gmzJ0TJpSs17gbCRfEf\nnyIwotkKIc/huiw5WpO6ssX1xM5miIjCCa4ZHZ12v4GC6VfvB4OV0jlgXy/cH1wk\nZGX23gTCA9/qZp2q1xFAcFz2e1siaL9m5OYezgyxAoGBAOZK6Mpi5oI1fu4UiN6j\nNGlwz/3lDlW6l2PHTFvfyvOnbdahRUa4ahdN+RKpjtbUjEttgWnMiXbMc/uVE4aV\nQ72H5ZCR2w7nXyksSAFFG2sDFyMpB1bRiMRVX7o1kuMkRM6rQLYSeKAv5TTCX3bL\naVOZANC9MUOfR4MFv/RxaILs\n-----END PRIVATE KEY-----\n",
            client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@iskcon-bhuvaikuntha.iam.gserviceaccount.com"
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase admin init error:", error);
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { title, body, imageUrl, actionUrl, topic } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'Title and Body are required' });
        }

        // Target: "temple_all" (All Devotees) or "leader_9876543210" (Specific Maharaj Devotees)
        const targetTopic = topic || "temple_all";

        // 🚀 Dual Android + iOS Lock Screen Compatible Payload
        const message = {
            topic: targetTopic,
            notification: {
                title: title,
                body: body,
                ...(imageUrl ? { imageUrl: imageUrl } : {})
            },
            data: {
                title: title,
                body: body,
                url: actionUrl || "index.html",
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    channelId: "iskcon_channel",
                    priority: "high",
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    ...(imageUrl ? { imageUrl: imageUrl } : {})
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body
                        },
                        sound: "default",
                        badge: 1,
                        "mutable-content": 1
                    }
                },
                fcm_options: {
                    ...(imageUrl ? { image: imageUrl } : {})
                }
            }
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ 
            success: true, 
            messageId: response, 
            targetTopic: targetTopic 
        });

    } catch (error) {
        console.error("Push delivery error:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to dispatch push' 
        });
    }
}
