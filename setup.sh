#!/bin/bash
# Quick setup script for PHP File Transfer Application

echo "======================================"
echo "PHP File Transfer Setup Script"
echo "======================================"
echo ""

# Create necessary directories
echo "Creating directories..."
mkdir -p php/api
mkdir -p data
mkdir -p uploads

# Set permissions
echo "Setting permissions..."
chmod 755 php/
chmod 755 php/api/
chmod 777 data/
chmod 777 uploads/

# Create .htaccess files if they don't exist
if [ ! -f "php/.htaccess" ]; then
    echo "Creating php/.htaccess"
    cat > php/.htaccess << 'EOF'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /php/

    # Prevent direct access to folders
    RewriteRule ^(data|uploads)/.*$ - [F]

    # Redirect all requests through index.php
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ index.php?request=$1 [QSA,L]
</IfModule>
EOF
fi

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Upload all files to your server"
echo "2. Update API_BASE in your JavaScript files if needed"
echo "3. Change the default admin password:"
echo "   Email: admin@filetransfer.com"
echo "   Password: admin123"
echo "4. Access the application at: http://your-domain.com/file-transfer/"
echo ""
echo "Important:"
echo "- Ensure PHP 7.4+ is installed"
echo "- Enable mod_rewrite in Apache"
echo "- Set proper file permissions"
echo ""
