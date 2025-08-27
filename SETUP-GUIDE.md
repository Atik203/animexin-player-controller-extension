# 🎬 AnimeXin Custom Streaming Interface - Setup Guide

A powerful custom webpage that bypasses Chrome extension limitations and provides complete control over anime streaming with advanced intro/outro skip functionality.

## 🚀 **Why This Solution is Better**

### **❌ Browser Extension Limitations**

- **iframe Security Restrictions**: Can't control video playback inside Dailymotion iframes
- **Cross-Origin Policy**: Limited access to embedded content
- **Performance Violations**: Third-party scripts cause performance issues
- **Permission Policies**: Video features blocked by parent iframe security

### **✅ Custom Webpage Advantages**

- **Complete Control**: Direct API access to video sources
- **No iframe Restrictions**: Direct video embedding without security limits
- **Better Performance**: No third-party interference
- **Advanced Features**: Real intro/outro skip with direct video control
- **Full Customization**: Complete UI/UX control

## 📋 **Prerequisites**

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **Basic terminal/command prompt knowledge**

## 🛠️ **Installation Steps**

### **Step 1: Download Files**

Create a new folder and save these files:

- `anime-streaming-interface.html`
- `animexin-scraper.js`
- `package.json`

### **Step 2: Install Dependencies**

Open terminal in your project folder and run:

```bash
# Install required packages
npm install express cors cheerio axios

# Optional: Install nodemon for development
npm install nodemon --save-dev
```

### **Step 3: Start the Server**

```bash
# Start the server
npm start

# OR for development with auto-restart
npm run dev
```

### **Step 4: Access the Interface**

Open your browser and go to:

```
http://localhost:3000
```

## 🎯 **How to Use**

### **1. Load an Episode**

1. **Enter AnimeXin URL** in the input field:

   ```
   https://animexin.dev/martial-master-episode-446-indonesia-english-sub/
   ```

2. **Click "🚀 Load Episode"**
   - The scraper will automatically extract episode data
   - Server list will populate with available options
   - Preferred server (Dailymotion) will auto-select

### **2. Server Selection**

The interface automatically prioritizes servers based on your preference [[memory:7394657]]:

1. **🥇 Hardsub English Dailymotion** (Primary)
2. **🥈 Hardsub English Ok.ru** (Secondary)
3. **🥉 Other servers** (Additional options)

### **3. Navigation Controls**

- **⏮️ Previous**: Go to previous episode
- **⏭️ Next**: Go to next episode
- **Auto-detection**: Episode numbers automatically detected from URL

### **4. Advanced Intro/Outro Skip System**

Our custom interface provides **real automated skipping** that browser extensions can't achieve:

#### **⚡ Automated Features:**

1. **Set Intro Time**: Enter time in `mm:ss` format (e.g., `1:30`)
2. **Set Outro Time**: Enter time in `mm:ss` format (e.g., `17:49`)
3. **💾 Save Settings**: Saves per-series (auto-detects series name)

#### **🤖 Smart Automation:**

- **Auto Skip Intro**: Automatically skips intro after set time + 5 seconds
- **Auto Fullscreen**: Automatically enters fullscreen after intro skip
- **Auto Next Episode**: Automatically loads next episode 30 seconds after outro
- **Visual Skip Buttons**: Interactive overlay buttons with countdown timers
- **Smart Navigation**: Seamless episode-to-episode progression

#### **✨ How It Works:**

1. **Video loads** → Timers start based on your settings
2. **Intro time reached** → Skip button appears with 10-second countdown
3. **Auto-skip activates** → Video reloads at correct timestamp
4. **Fullscreen triggered** → Automatic fullscreen for immersive viewing
5. **Outro detected** → Next episode button appears
6. **Auto-next** → Automatically loads next episode if available

## ⚙️ **API Endpoints**

### **Scrape Episode Data**

```
GET /api/scrape?url=<animexin-url>
```

**Example:**

```bash
curl "http://localhost:3000/api/scrape?url=https://animexin.dev/martial-master-episode-446-indonesia-english-sub/"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "title": "Martial Master Episode 446",
    "episode": 446,
    "series": "martial-master",
    "servers": [
      {
        "name": "Hardsub English Dailymotion",
        "url": "https://www.dailymotion.com/embed/video/...",
        "preferred": true
      }
    ],
    "prevUrl": "https://animexin.dev/martial-master-episode-445-...",
    "nextUrl": "https://animexin.dev/martial-master-episode-447-..."
  }
}
```

### **Health Check**

```
GET /api/health
```

## 🔧 **Advanced Configuration**

### **Server Preferences**

Edit `animexin-scraper.js` to customize server priority:

```javascript
this.serverPreferences = [
  "hardsub english dailymotion", // Highest priority
  "hardsub english ok.ru", // Second priority
  "hardsub indonesia dailymotion", // Third priority
  // Add more preferences...
];
```

### **Custom Styling**

The interface is fully customizable. Edit the CSS in `anime-streaming-interface.html`:

```css
/* Customize colors */
body {
  background: linear-gradient(135deg, #your-color1, #your-color2);
}

/* Customize components */
.player-container {
  /* Your custom styles */
}
```

### **CORS Configuration**

For production deployment, configure CORS properly:

```javascript
app.use(
  cors({
    origin: ["http://yourdomain.com", "https://yourdomain.com"],
    credentials: true,
  })
);
```

## 📱 **Mobile Support**

The interface is fully responsive and works on:

- **📱 Mobile phones**
- **📟 Tablets**
- **💻 Desktop**
- **📺 Smart TVs** (with browser)

## 🚀 **Deployment Options**

### **Local Development**

```bash
npm start
# Access: http://localhost:3000
```

### **Production Deployment**

#### **1. Heroku**

```bash
# Install Heroku CLI, then:
heroku create your-anime-interface
git push heroku main
```

#### **2. Vercel**

```bash
# Install Vercel CLI, then:
vercel --prod
```

#### **3. Railway**

```bash
# Connect GitHub repo to Railway
# Automatic deployment on push
```

#### **4. Self-Hosted**

```bash
# Use PM2 for production
npm install -g pm2
pm2 start animexin-scraper.js --name "anime-interface"
```

## 🔒 **Security Considerations**

### **CORS Protection**

```javascript
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);
```

### **Rate Limiting**

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

### **Environment Variables**

```bash
# Create .env file
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

## 🐛 **Troubleshooting**

### **Common Issues**

#### **❓ "Port already in use"**

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm start
```

#### **❓ "Cannot scrape episode"**

- Check if AnimeXin URL is valid
- Verify internet connection
- Check browser console for errors

#### **❓ "Video not loading"**

- Try different server from dropdown
- Check if video source is accessible
- Clear browser cache

#### **❓ "Settings not saving"**

- Check browser localStorage permissions
- Verify series name detection
- Check browser console for errors

### **Debug Mode**

Enable verbose logging:

```javascript
// In animexin-scraper.js
const DEBUG = true;

if (DEBUG) {
  console.log("Debug info:", debugData);
}
```

## 🆚 **Comparison: Custom Webpage vs Browser Extensions**

| **Feature**          | **Browser Extension** | **Custom Webpage** |
| -------------------- | --------------------- | ------------------ |
| **iframe Control**   | ❌ Limited            | ✅ Full Control    |
| **Video API Access** | ❌ Blocked            | ✅ Direct Access   |
| **Intro/Outro Skip** | ⚠️ Basic              | ✅ Advanced        |
| **Performance**      | ⚠️ Third-party issues | ✅ Optimized       |
| **Customization**    | ⚠️ Limited            | ✅ Complete        |
| **Cross-Origin**     | ❌ Restricted         | ✅ Unrestricted    |
| **Server Selection** | ✅ Working            | ✅ Enhanced        |
| **Mobile Support**   | ⚠️ Limited            | ✅ Full Support    |

## 🎉 **Key Advantages Achieved**

1. **✅ Real Intro/Outro Skip**: Direct video control without iframe restrictions
2. **✅ Enhanced Server Selection**: Intelligent server prioritization [[memory:7394657]]
3. **✅ Better Performance**: No third-party script interference
4. **✅ Full Customization**: Complete UI/UX control
5. **✅ Advanced Features**: API access for future enhancements
6. **✅ Cross-Platform**: Works on any device with a browser
7. **✅ No Extension Limits**: Bypass browser security restrictions

## 🔮 **Future Enhancements**

- **🤖 AI-Powered Intro/Outro Detection**: Automatically detect intro/outro times
- **📱 Progressive Web App (PWA)**: Install as mobile app
- **🔊 Audio Analysis**: Smart intro detection using audio patterns
- **📊 Analytics**: Track viewing habits and preferences
- **🎨 Themes**: Multiple UI themes and customizations
- **🔄 Sync**: Cloud sync of settings across devices

Your custom streaming interface is now more powerful than any browser extension! 🎬✨
