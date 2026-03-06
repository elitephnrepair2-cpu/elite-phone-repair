import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = join(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'application/font-woff',
    '.woff2': 'application/font-woff2',
    '.ttf': 'application/font-ttf',
};

const server = createServer((req, res) => {
    if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    const urlPath = req.url.split('?')[0];
    let filePath = join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

    try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
            filePath = join(filePath, 'index.html');
        }
    } catch (err) {
        // If file doesn't exist, route back to index.html for Single Page Application
        filePath = join(PUBLIC_DIR, 'index.html');
    }

    try {
        const data = readFileSync(filePath);
        const ext = String(extname(filePath)).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (err) {
        res.writeHead(500);
        res.end('Internal Server Error');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening natively on port ${PORT}`);
});
