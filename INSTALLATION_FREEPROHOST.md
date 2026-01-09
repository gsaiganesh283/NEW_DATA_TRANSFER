# File Transfer Application - PHP Version for Freeprohost

This is a complete PHP conversion of the secure file transfer application, optimized for deployment on freeprohost.

## Features

- 📄 **File Transfer**: Upload and share files with transfer codes
- 🔐 **Password Protection**: Protect transfers with passwords
- 👥 **User Accounts**: Create accounts for enhanced features
- 🛡️ **Admin Dashboard**: Manage users and transfers
- 📦 **ZIP Downloads**: Download all files as ZIP
- ⏰ **Auto Expiry**: Files automatically expire after configured time
- 📊 **Statistics**: Track uploads and downloads

## Requirements

- PHP 7.4 or higher
- Apache web server with mod_rewrite enabled
- 5GB+ disk space for file uploads
- cURL support for file operations

## Installation on Freeprohost

### Step 1: Upload Files

1. Download all files from the repository
2. Connect to your freeprohost account via FTP
3. Create a folder named `file-transfer` in your public_html
4. Upload all files, maintaining the directory structure:
   ```
   public_html/
   ├── file-transfer/
   │   ├── php/
   │   │   ├── api/
   │   │   ├── config.php
   │   │   ├── jwt.php
   │   │   ├── index.php
   │   │   └── .htaccess
   │   ├── data/
   │   ├── uploads/
   │   ├── *.html (index.html, login.html, etc.)
   │   ├── *.js (app.js, admin.js, auth-php.js)
   │   ├── *.css (styles.css, auth.css)
   │   └── .htaccess
   ```

### Step 2: Set Permissions

Set proper directory permissions via FTP or File Manager:

```
chmod 755 public_html/file-transfer/
chmod 755 public_html/file-transfer/php/
chmod 755 public_html/file-transfer/php/api/
chmod 777 public_html/file-transfer/data/
chmod 777 public_html/file-transfer/uploads/
```

### Step 3: Create Data Directory

The `data/` directory will store:
- `users.json` - User accounts and credentials
- `transfers.json` - Active file transfers
- `settings.json` - Application settings

These are created automatically on first run.

### Step 4: Update API Base Path

Edit your JavaScript files and update the API_BASE variable if needed:

**In auth-php.js and app-php.js:**
```javascript
const API_BASE = '/file-transfer/php';
```

Adjust the path based on your folder structure.

### Step 5: Update HTML Files

Update the script references in your HTML files to use the PHP versions:

**In index.html, login.html, signup.html, admin.html:**
Replace:
```html
<script src="auth.js"></script>
<script src="app.js"></script>
<script src="admin.js"></script>
```

With:
```html
<script src="auth-php.js"></script>
<script src="app-php.js"></script>
<script src="admin-php.js"></script>
```

### Step 6: Access Application

Open your browser and navigate to:
```
https://yourdomain.freehostia.com/file-transfer/
```

## Default Admin Credentials

Email: `admin@filetransfer.com`
Password: `admin123`

**IMPORTANT**: Change these credentials after first login!

## Configuration

Edit `php/config.php` to adjust:

```php
define('MAX_FILE_SIZE', 2000);      // MB per file
define('MAX_FILES', 50);            // Number of files per transfer
define('EXPIRY_TIME', 24);          // Hours before auto-deletion
define('ALLOW_ANONYMOUS', true);    // Allow uploads without login
```

## API Endpoints

### Authentication
- `POST /php/auth/signup` - Create new account
- `POST /php/auth/login` - Login
- `GET /php/auth/verify` - Verify token
- `POST /php/auth/logout` - Logout

### File Operations
- `POST /php/api/upload` - Upload files
- `GET /php/api/files/{code}` - Get file info
- `POST /php/api/files/{code}/verify` - Verify password
- `GET /php/api/download/{code}/{index}` - Download single file
- `GET /php/api/download-zip/{code}` - Download as ZIP
- `DELETE /php/api/files/{code}` - Delete transfer

### Admin Operations
- `GET /php/api/admin/stats` - Dashboard statistics
- `GET /php/api/admin/users` - List all users
- `POST /php/api/admin/change-password` - Change password

## Troubleshooting

### 404 Errors on API Calls

Check that mod_rewrite is enabled. Add this to `.htaccess`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /file-transfer/php/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.php?request=$1 [QSA,L]
</IfModule>
```

### File Upload Errors

If you get file size errors:

1. Create a file `php/upload.ini`:
```ini
upload_max_filesize = 2000M
post_max_size = 2000M
memory_limit = 256M
max_execution_time = 300
```

2. Add this line to `php/config.php`:
```php
@ini_set('upload_max_filesize', '2000M');
@ini_set('post_max_size', '2000M');
```

### Permission Errors

Run these commands via SSH or cPanel Terminal:

```bash
find /home/username/public_html/file-transfer -type d -exec chmod 755 {} \;
find /home/username/public_html/file-transfer -type f -exec chmod 644 {} \;
chmod 777 /home/username/public_html/file-transfer/data/
chmod 777 /home/username/public_html/file-transfer/uploads/
```

### Data Directory Issues

If you can't create the `data/` directory, create it manually via FTP:

1. FTP to your server
2. Navigate to `/file-transfer/`
3. Create new folder: `data`
4. Set permissions to 777
5. Refresh the page

## Security Notes

1. **Change Admin Password**: Login and change the default admin password immediately
2. **HTTPS**: Always use HTTPS in production
3. **API Security**: All API endpoints validate authentication
4. **File Permissions**: Never set permissions to 777 unless necessary
5. **Backup Data**: Regularly backup the `data/` directory

## Environment Variables (Optional)

For enhanced security, create a `.env` file:

```
JWT_SECRET=your-super-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Backup & Restore

### Backup

Download these directories regularly:
- `data/` - Contains users, transfers, and settings
- `uploads/` - Contains all uploaded files

### Restore

1. Delete old files from the server
2. Upload the backed-up files
3. Ensure permissions are correct (777 for data/ and uploads/)

## Support

For issues specific to freeprohost:
1. Check that PHP version is 7.4+
2. Verify mod_rewrite is enabled in .htaccess
3. Check file permissions
4. Review error logs in cPanel

## License

MIT License - Feel free to use and modify for your needs.

## Version

PHP Version 1.0 - Compatible with Freeprohost
