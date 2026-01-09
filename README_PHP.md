# File Transfer Application - PHP Complete Version

A complete PHP conversion of the secure file transfer application, fully compatible with freeprohost and other shared hosting environments.

## 📋 Table of Contents

- [Features](#features)
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [FAQ](#faq)

## ✨ Features

### Core Features
- 📤 **File Upload**: Upload multiple files at once
- 📥 **File Download**: Download single files or all as ZIP
- 🔗 **Transfer Codes**: Share files using unique 6-character codes
- 🔐 **Password Protection**: Protect transfers with optional passwords
- ⏰ **Auto Expiry**: Automatically delete files after expiration time
- 👥 **User Accounts**: Register and manage user accounts
- 🛡️ **Admin Dashboard**: Comprehensive admin panel for management

### Advanced Features
- 📊 **Statistics**: Track downloads and storage usage
- 👤 **User Management**: Create, edit, and delete users
- 🎛️ **Settings Management**: Configure application behavior
- 🔑 **Role-Based Access**: Admin and Super Admin roles
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚡ **Lightweight**: No database required, uses JSON storage

## 📦 System Requirements

- **PHP**: 7.4 or higher
- **Web Server**: Apache with mod_rewrite enabled
- **Storage**: Minimum 5GB for uploads
- **Memory**: 256MB PHP memory limit recommended
- **Extensions**: 
  - cURL (optional)
  - ZipArchive (for ZIP downloads)

## 🚀 Quick Start

### 1. Download & Extract
```bash
# Download the application
cd /path/to/public_html
unzip file-transfer.zip
cd file-transfer
```

### 2. Set Permissions
```bash
chmod 755 .
chmod 755 php/
chmod 755 php/api/
chmod 777 data/
chmod 777 uploads/
```

### 3. Access Application
Open browser and navigate to:
```
https://yourdomain.com/file-transfer/
```

### 4. Login with Admin
```
Email: admin@filetransfer.com
Password: admin123
```

### 5. Change Password
Go to Admin Dashboard → Settings → Change Password

## 📚 Installation Guide

### For Freeprohost

1. **Access Control Panel**
   - Go to cPanel/Hosting Control Panel
   - Navigate to File Manager

2. **Upload Files**
   ```
   public_html/
   ├── file-transfer/
   │   ├── php/
   │   │   ├── api/
   │   │   │   ├── auth.php
   │   │   │   ├── files.php
   │   │   │   └── admin.php
   │   │   ├── config.php
   │   │   ├── jwt.php
   │   │   ├── index.php
   │   │   └── .htaccess
   │   ├── data/        (create empty)
   │   ├── uploads/     (create empty)
   │   ├── .htaccess
   │   ├── index.html
   │   ├── login.html
   │   ├── signup.html
   │   ├── admin.html
   │   ├── app-php.js
   │   ├── auth-php.js
   │   ├── admin-php.js
   │   ├── styles.css
   │   └── auth.css
   ```

3. **Set Permissions**
   - Right-click directory → Properties → Change Permissions
   - Set to `755` for PHP files and directories
   - Set to `777` for `data/` and `uploads/` directories

4. **Verify Setup**
   - Open `https://yourdomain.freehostia.com/file-transfer/`
   - Should see login page

### For Other Hosting Providers

1. **FTP Upload**
   - Use FTP client to upload files
   - Maintain directory structure

2. **SSH Setup** (if available)
   ```bash
   ssh user@server.com
   cd public_html
   unzip file-transfer.zip
   chmod -R 755 file-transfer/
   chmod 777 file-transfer/data file-transfer/uploads
   ```

3. **Verify mod_rewrite**
   - Check `.htaccess` is respected
   - Verify rewrite rules are working

## ⚙️ Configuration

### Basic Configuration

Edit `php/config.php`:

```php
// Maximum file size (MB)
define('MAX_FILE_SIZE', 2000);

// Maximum files per transfer
define('MAX_FILES', 50);

// Expiry time (hours)
define('EXPIRY_TIME', 24);

// Allow anonymous uploads
define('ALLOW_ANONYMOUS', true);

// JWT Secret (change this!)
define('JWT_SECRET', 'your-super-secret-key-here');
```

### Update API Path

If deployed in a subdirectory, update in JavaScript files:

**auth-php.js, app-php.js, admin-php.js:**
```javascript
const API_BASE = '/your-subdirectory/php';
```

### PHP Upload Limits

Create `php/upload.ini`:
```ini
upload_max_filesize = 2000M
post_max_size = 2000M
memory_limit = 256M
max_execution_time = 300
```

## 📡 API Documentation

### Authentication Endpoints

#### POST `/php/auth/signup`
Register new user
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### POST `/php/auth/login`
Login user
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### GET `/php/auth/verify`
Verify token validity (requires Authorization header)

#### POST `/php/auth/logout`
Logout user (requires Authorization header)

### File Transfer Endpoints

#### POST `/php/api/upload`
Upload files (multipart/form-data)
```
files: [file1, file2, ...]
password: optional
message: optional
expiryTime: optional (hours)
```
Returns:
```json
{
  "transferCode": "ABC123",
  "fileCount": 2,
  "totalSize": 1024000,
  "expiresIn": "24 hour(s)"
}
```

#### GET `/php/api/files/{code}`
Get file information
Returns file list and transfer details

#### POST `/php/api/files/{code}/verify`
Verify password for protected transfer
```json
{
  "password": "pass123"
}
```

#### GET `/php/api/download/{code}/{index}`
Download single file
Query params: `password` (if protected)

#### GET `/php/api/download-zip/{code}`
Download all files as ZIP
Query params: `password` (if protected), `indexes` (optional)

#### DELETE `/php/api/files/{code}`
Delete transfer

### Admin Endpoints

All admin endpoints require `Authorization: Bearer <token>` header with admin role.

#### GET `/php/api/admin/stats`
Get dashboard statistics

#### GET `/php/api/admin/users`
List all users

#### PUT `/php/api/admin/users/{id}`
Update user
```json
{
  "name": "New Name",
  "email": "new@example.com",
  "role": "admin"
}
```

#### DELETE `/php/api/admin/users/{id}`
Delete user

#### GET `/php/api/admin/transfers`
List all transfers

#### DELETE `/php/api/admin/transfers/{code}`
Delete transfer (admin only)

#### GET `/php/api/admin/settings`
Get current settings

#### PUT `/php/api/admin/settings`
Update settings
```json
{
  "maxFileSize": 2000,
  "maxFiles": 50,
  "expiryTime": 24,
  "allowAnonymous": true
}
```

#### POST `/php/api/admin/change-password`
Change user password
```json
{
  "currentPassword": "old123",
  "newPassword": "new123"
}
```

## 🔧 Troubleshooting

### 404 Errors on API Calls

**Problem**: API endpoints return 404

**Solution**:
1. Verify `.htaccess` files exist in `php/` directory
2. Check mod_rewrite is enabled:
   ```bash
   a2enmod rewrite
   systemctl restart apache2
   ```
3. Verify RewriteBase matches your path

### File Upload Fails

**Problem**: Upload returns error or fails

**Solutions**:
1. Check PHP upload limits:
   ```php
   phpinfo(); // Check upload_max_filesize and post_max_size
   ```
2. Verify `uploads/` directory permissions (777)
3. Check available disk space
4. Increase PHP timeouts in `.htaccess`

### Data Not Persisting

**Problem**: User data or transfers disappear

**Solutions**:
1. Verify `data/` directory is writable (777)
2. Check file ownership is correct
3. Ensure disk space is available
4. Check filesystem isn't read-only

### Password Verification Issues

**Problem**: Correct password rejected

**Solution**:
1. Clear browser cache and cookies
2. Verify bcrypt is working in PHP
3. Check password hash in `data/transfers.json`

### Admin Dashboard Not Loading

**Problem**: Admin page shows errors or blank

**Solutions**:
1. Verify token is valid
2. Check user role is 'admin' or 'superadmin'
3. Verify JavaScript console for errors
4. Check API endpoints are returning data

## 🔒 Security

### Best Practices

1. **Change Default Credentials**
   - Change admin password immediately after first login
   - Don't share credentials

2. **Use HTTPS**
   - Always use HTTPS in production
   - Redirect HTTP to HTTPS

3. **Keep Backups**
   - Regular backups of `data/` directory
   - Store backups securely

4. **Monitor Uploads**
   - Review admin dashboard regularly
   - Check for suspicious activity

5. **File Permissions**
   - Set proper permissions (755 for code, 777 for data)
   - Restrict access to `data/` directory
   - Never make files world-writable unless necessary

6. **Update JWT Secret**
   - Change `JWT_SECRET` in config.php
   - Use strong random string (40+ characters)

### File Security

- Files are stored outside web root when possible
- Direct access to `data/` is blocked by `.htaccess`
- File downloads require valid transfer code
- Password-protected transfers are bcrypt hashed

## ❓ FAQ

### Can I change the default password?
Yes, after logging in go to Admin Dashboard → Settings → Change Password

### How long are files stored?
Default is 24 hours, configurable in admin settings

### What file types are supported?
All file types are supported. PHP configuration limits file size and count.

### Can I disable file expiry?
Set expiryTime to 0 or very high number in settings

### How do I backup my data?
Download `data/` directory via FTP or File Manager

### Can I restore from backup?
Yes, upload backed-up files via FTP, ensuring permissions are correct

### Is there a file size limit?
Yes, default is 2000MB per file, configurable in settings

### Can I increase file size limit?
Yes, update PHP limits and settings:
1. Edit `php/config.php`
2. Update `.htaccess` php_value directives
3. Check hosting provider limits

### How do I migrate from Node.js to PHP?
This IS the PHP migration! Just upload files and configure.

### Can I use this with a database?
Currently uses JSON files. Database integration possible but not included.

### Is there a mobile app?
Use the responsive web interface on mobile

### Can I set custom file expiry per transfer?
Not in current UI, but API supports it: `expiryTime` in upload

## 📞 Support

For issues:
1. Check troubleshooting section
2. Review `php/config.php` comments
3. Check browser console (F12) for errors
4. Enable PHP error logging
5. Contact hosting provider for server issues

## 📄 License

MIT License - Free to use and modify

## 🎉 Getting Started

1. Upload files to hosting
2. Set permissions
3. Access application
4. Login with admin credentials
5. Change password
6. Configure settings
7. Start using!

---

**Version**: 1.0 - PHP
**Compatibility**: PHP 7.4+, Apache, Freeprohost
**Last Updated**: 2024
