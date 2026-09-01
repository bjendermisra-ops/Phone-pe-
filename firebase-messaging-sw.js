importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAHksBlu9ue2p7AxXuUKALmEws5mscO908",
    authDomain: "iskcon-bhuvaikuntha.firebaseapp.com",
    projectId: "iskcon-bhuvaikuntha",
    storageBucket: "iskcon-bhuvaikuntha.firebasestorage.app",
    messagingSenderId: "87535383708",
    appId: "1:87535383708:web:7548e3b7d4c807faafe959"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Background Push:', payload);
    const title = payload.notification?.title || payload.data?.title || "ISKCON Bhuvaikuntha";
    const options = {
        body: payload.notification?.body || payload.data?.body || "",
        icon: '/logo.webp',
        image: payload.notification?.image || payload.data?.imageUrl || '',
        badge: '/logo.webp',
        data: {
            url: payload.data?.actionUrl || 'index.html',
            targetLeaderId: payload.data?.targetLeaderId || ''
        }
    };
    return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || 'index.html')
    );
});
