require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const helmet = require('helmet');
const morgan = require('morgan');
const os = require('os');

// Routes
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require("./routes/user.routes")
const app = express();

//setup morgan logger
app.use(morgan('dev'));

// Connect to MongoDB
connectDB();

// Security middleware
// This middleware sets HTTP headers to secure the app by setting various Content Security Policies.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"], // Allows scripts to be loaded from the same origin and inline scripts
            "img-src": ["'self'", "data:", "https:"], // Allows images from the same origin, data URLs, and HTTPS URLs
        },
    },
}));
app.use(compression());

// Rate limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100 // limit each IP to 100 requests per windowMs
// });
// app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
app.use(cors({
    origin: true, // Allow requests from this domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Specify allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    credentials: true, // Include cookies in cross-origin requests
}));

// Routes
// app.use('/', viewRoutes);
// app.use('/public', publicRoutes);
app.get('/', (req, res) => {
    console.log('Hello World');
    res.status(200).json({ message: 'Hello World' });
});
app.use('/api/admin', adminRoutes);
app.use("/api/user", userRoutes);

// Error handling
app.use(errorHandler);


const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
     const ip = getLocalIP();
    console.log(`Server running on port ${PORT}`);
    console.log(`   🌐  Local:   http://localhost:${PORT}`);
    console.log(`   🖥️  Network: http://${ip}:${PORT}`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    process.exit(1);
});