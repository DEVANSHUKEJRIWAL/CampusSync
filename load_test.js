import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    // Ramp up to 50 users over 10s, stay for 20s, ramp down
    stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
    ],
    // Pass/Fail Thresholds
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must be faster than 500ms
        http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
    },
};

export default function () {
    // Test the Public Events Endpoint (Read Heavy)
    // Note: We use 'host.docker.internal' if running k6 via Docker to reach your local machine
    // If that fails, replace with your local IP address (e.g., 'http://192.168.1.5:8080/api/events')
    const res = http.get('http://host.docker.internal:8080/api/events');

    check(res, {
        'status is 200': (r) => r.status === 200,
        'content type is json': (r) => r.headers['Content-Type'].includes('application/json'),
    });

    sleep(1);
}