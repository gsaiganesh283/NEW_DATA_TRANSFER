# PHP File Transfer Application - Deployment Checklist for Freeprohost

## Pre-Deployment

- [ ] Verify PHP version is 7.4 or higher
- [ ] Verify mod_rewrite is enabled
- [ ] Create backup of current website
- [ ] Download all application files

## Server Setup

- [ ] Create `file-transfer` directory in `public_html/`
- [ ] Upload all files maintaining directory structure
- [ ] Set directory permissions:
  ```
  chmod 755 public_html/file-transfer/
  chmod 755 public_html/file-transfer/php/
  chmod 755 public_html/file-transfer/php/api/
  chmod 777 public_html/file-transfer/data/
  chmod 777 public_html/file-transfer/uploads/
  ```
- [ ] Verify `.htaccess` files are present in:
  - `public_html/file-transfer/.htaccess`
  - `public_html/file-transfer/php/.htaccess`

## Application Configuration

- [ ] Test application at: `https://yourdomain.freehostia.com/file-transfer/`
- [ ] Verify data directory is writable
- [ ] Verify uploads directory is writable
- [ ] Check browser console for errors (F12)

## Initial Configuration

- [ ] Login with default credentials:
  - Email: `admin@filetransfer.com`
  - Password: `admin123`
- [ ] Change admin password immediately
- [ ] Configure settings:
  - Max file size
  - Max files per transfer
  - Expiry time
  - Anonymous uploads

## Testing

- [ ] Test file upload (anonymous)
- [ ] Test file download
- [ ] Test transfer code sharing
- [ ] Test password protection
- [ ] Test user registration
- [ ] Test user login
- [ ] Test admin dashboard
- [ ] Test user management

## Security

- [ ] Change default admin password
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set up regular backups
- [ ] Monitor storage usage
- [ ] Review security logs

## Production Optimization

- [ ] Disable debug mode in PHP files
- [ ] Set appropriate file permissions (no 777 unless necessary)
- [ ] Configure email notifications (optional)
- [ ] Set up automated cleanup of expired files
- [ ] Monitor server logs for errors

## Monitoring

- [ ] Check disk space regularly
- [ ] Monitor user activity
- [ ] Review error logs
- [ ] Track storage usage

## Backup & Disaster Recovery

- [ ] Backup `data/` directory
- [ ] Backup `uploads/` directory
- [ ] Document backup procedure
- [ ] Test restore procedure

## Support Resources

If you encounter issues:

1. **Check File Permissions**
   ```bash
   ls -la /path/to/file-transfer/
   ls -la /path/to/file-transfer/php/
   ```

2. **Check PHP Version**
   ```bash
   php -v
   ```

3. **Check mod_rewrite Status**
   Look in cPanel > Apache Modules or verify in `.htaccess` test

4. **Review Server Logs**
   - Apache error log
   - PHP error log
   - Application data directory

5. **Common Issues & Solutions**

   **Issue**: 404 errors on API calls
   - **Solution**: Enable mod_rewrite, verify `.htaccess` rules

   **Issue**: File upload fails
   - **Solution**: Check upload_max_filesize and post_max_size in php.ini

   **Issue**: Permission denied errors
   - **Solution**: Fix directory permissions (chmod 777)

   **Issue**: Data not persisting
   - **Solution**: Ensure `data/` directory has write permissions

## Support Contacts

- Freeprohost Support: https://www.freeprohost.com/
- PHP Documentation: https://www.php.net/manual/
- Apache mod_rewrite: https://httpd.apache.org/docs/current/mod/mod_rewrite.html

---

**Version**: 1.0
**Last Updated**: 2024
**Status**: Ready for Production
