const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { bucket } = require('./firebaseConfig');

const prisma = new PrismaClient();

// Constants for encryption and security
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const HASH_ALGORITHM = 'sha256';
const HMAC_ALGORITHM = 'sha256';

// Paths for RSA keys (store securely)
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH || path.join(__dirname, 'keys', 'private.pem');
const PUBLIC_KEY_PATH = process.env.PUBLIC_KEY_PATH || path.join(__dirname, 'keys', 'public.pem');

// Create key directory if it doesn't exist
const ensureKeyDirectory = () => {
  const keyDir = path.dirname(PRIVATE_KEY_PATH);
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
    console.log(`Created key directory: ${keyDir}`);
  }
};

// Generate RSA key pair (run once, store securely)
const generateKeyPair = () => {
  try {
    console.log('Generating RSA key pair');
    ensureKeyDirectory();
    execSync(`openssl genrsa -out "${PRIVATE_KEY_PATH}" 2048`);
    execSync(`openssl rsa -in "${PRIVATE_KEY_PATH}" -outform PEM -pubout -out "${PUBLIC_KEY_PATH}"`);
    // Set permissions (Windows: use icacls)
    if (process.platform === 'win32') {
      execSync(`icacls "${PRIVATE_KEY_PATH}" /inheritance:r`);
      execSync(`icacls "${PUBLIC_KEY_PATH}" /inheritance:r`);
      execSync(`icacls "${PRIVATE_KEY_PATH}" /grant "%username%:F"`);
      execSync(`icacls "${PUBLIC_KEY_PATH}" /grant "%username%:F"`);
    } else {
      execSync(`chmod 600 "${PRIVATE_KEY_PATH}" "${PUBLIC_KEY_PATH}"`);
    }
    console.log('RSA key pair generated');
  } catch (error) {
    console.error('Failed to generate key pair:', error);
    throw new Error('Failed to generate key pair');
  }
};

// Check if keys exist, generate if not
const ensureKeysExist = () => {
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RSA keys are required in production. Set PRIVATE_KEY_PATH and PUBLIC_KEY_PATH.');
    }
    generateKeyPair();
  }
};

// AES encryption key and IV generation
const generateEncryptionKey = () => {
  return crypto.randomBytes(32); // 256 bits
};

const generateIV = () => {
  return crypto.randomBytes(12); // 96 bits for AES-GCM
};

// Encrypt file using AES-256-GCM
const encryptFile = (buffer, key, iv) => {
  try {
    console.log('Encrypting file, buffer size:', buffer.length);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    console.log('Encryption successful, encrypted size:', encrypted.length);
    return { encrypted, authTag };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

// Decrypt file using AES-256-GCM
const decryptFile = (encryptedBuffer, key, iv, authTag) => {
  try {
    console.log('Decrypting file, encrypted size:', encryptedBuffer.length);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    console.log('Decryption successful, decrypted size:', decrypted.length);
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// Calculate SHA-256 hash
const calculateHash = (buffer) => {
  const hash = crypto.createHash(HASH_ALGORITHM).update(buffer).digest('hex');
  console.log('Calculated hash:', hash);
  return hash;
};

// Generate HMAC
const generateHMAC = (buffer, key) => {
  const hmac = crypto.createHmac(HMAC_ALGORITHM, key).update(buffer).digest('hex');
  console.log('Generated HMAC:', hmac);
  return hmac;
};

// Verify HMAC
const verifyHMAC = (buffer, key, originalHmac) => {
  const hmac = generateHMAC(buffer, key);
  const isValid = hmac === originalHmac;
  console.log('HMAC verification:', isValid, 'Computed:', hmac, 'Original:', originalHmac);
  return isValid;
};

// Sign document using OpenSSL
const signDocument = (buffer) => {
  try {
    console.log('Signing document with OpenSSL');
    // Write buffer to a temporary file
    const tempDir = process.env.TEMP || '/tmp';
    const tempFile = path.join(tempDir, `doc_${Date.now()}.bin`);
    fs.writeFileSync(tempFile, buffer);

    // Sign with OpenSSL and capture binary output
    const signatureBinary = execSync(`openssl dgst -sha256 -sign "${PRIVATE_KEY_PATH}" "${tempFile}"`);

    // Encode to base64 using Node.js
    const signatureStr = signatureBinary.toString('base64').trim();

    // Clean up
    fs.unlinkSync(tempFile);
    console.log('OpenSSL signature generated:', signatureStr);
    return signatureStr;
  } catch (error) {
    console.error('Failed to sign document with OpenSSL:', error);
    throw new Error('Failed to sign document');
  }
};

// Verify signature using OpenSSL
const verifySignature = (buffer, signature, publicKeyPem) => {
  try {
    console.log('Verifying signature with OpenSSL');
    // Write buffer and signature to temporary files
    const tempDir = process.env.TEMP || '/tmp';
    const tempFile = path.join(tempDir, `doc_${Date.now()}.bin`);
    const sigFile = path.join(tempDir, `sig_${Date.now()}.bin`);
    const tempPublicKeyFile = path.join(tempDir, `pubkey_${Date.now()}.pem`);

    fs.writeFileSync(tempFile, buffer);
    fs.writeFileSync(sigFile, Buffer.from(signature, 'base64'));
    fs.writeFileSync(tempPublicKeyFile, publicKeyPem);

    // Verify with OpenSSL using the temporary public key file
    execSync(`openssl dgst -sha256 -verify "${tempPublicKeyFile}" -signature "${sigFile}" "${tempFile}"`);

    // Clean up
    fs.unlinkSync(tempFile);
    fs.unlinkSync(sigFile);
    fs.unlinkSync(tempPublicKeyFile);
    console.log('OpenSSL signature verified');
    return true;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

class DocumentService {
  async uploadDocument(file, userId, metadata = {}) {
    try {
      // Validate file
      if (!file.buffer) {
        throw new Error('Invalid file buffer');
      }
      console.log('Uploading document:', file.originalname, 'Size:', file.size);

      // Ensure RSA keys exist
      ensureKeysExist();

      // Generate encryption key and IV
      const key = generateEncryptionKey();
      const iv = generateIV();

      // Encrypt file
      const { encrypted: encryptedBuffer, authTag } = encryptFile(file.buffer, key, iv);
      console.log('Encrypted buffer size before upload:', encryptedBuffer.length, 'Buffer sample:', encryptedBuffer.slice(0, 10).toString('hex'));

      // Calculate hash of original file
      const hash = calculateHash(file.buffer);

      // Generate HMAC on encrypted buffer
      const hmacKey = crypto.randomBytes(32).toString('hex');
      const hmac = generateHMAC(encryptedBuffer, hmacKey);

      // Sign document
      const signature = signDocument(file.buffer);

      // Read the public key from the file
      const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
      //console.log('Public key read for storage:', publicKeyPem);

      // Upload encrypted file to Firebase Storage with .aes extension
      const firebasePath = `documents/${userId}/${Date.now()}_${file.originalname}.aes`;
      const firebaseFile = bucket.file(firebasePath);
      console.log('Saving encrypted file to Firebase:', firebasePath);
      await firebaseFile.save(encryptedBuffer, {
        metadata: { contentType: 'application/octet-stream' }, // Encrypted data
      });

      const [firebaseUrl] = await firebaseFile.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });
      console.log('Generated signed URL:', firebaseUrl);

      // Store document metadata in Prisma, including the public key
      const document = await prisma.document.create({
        data: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          firebaseUrl,
          firebasePath,
          hash,
          hmac,
          hmacKey,
          signature,
          encryptionKey: key.toString('hex'),
          encryptionIv: iv.toString('hex'),
          authTag: authTag.toString('hex'),
          publicKey: publicKeyPem, // Store the public key in PEM format
          userId,
          questionId: metadata.questionId ? parseInt(metadata.questionId) : null,
        },
      });
      console.log('Stored document metadata in Prisma:', document.id);

      return {
        id: document.id,
        filename: document.filename,
        size: document.size,
        mimeType: document.mimeType,
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error(`Error uploading document: ${error.message}`);
    }
  }

  async downloadDocument(documentId, userId) {
    try {
      console.log('Downloading document:', documentId, 'for user:', userId);
      const document = await prisma.document.findUnique({
        where: { id: parseInt(documentId) },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permission
      const hasAccess = await this.checkAccess(document, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Download encrypted file from Firebase
      const file = bucket.file(document.firebasePath);
      const [encryptedBuffer] = await file.download();
      console.log('Downloaded encrypted file, size:', encryptedBuffer.length, 'Buffer sample:', encryptedBuffer.slice(0, 10).toString('hex'));

      // Verify HMAC
      if (!verifyHMAC(encryptedBuffer, document.hmacKey, document.hmac)) {
        throw new Error('Document integrity check failed: HMAC verification failed');
      }

      // Decrypt file
      const key = Buffer.from(document.encryptionKey, 'hex');
      const iv = Buffer.from(document.encryptionIv, 'hex');
      const authTag = Buffer.from(document.authTag, 'hex');
      const decryptedBuffer = decryptFile(encryptedBuffer, key, iv, authTag);

      // Verify hash
      const hash = calculateHash(decryptedBuffer);
      if (hash !== document.hash) {
        throw new Error('Document integrity check failed: hash mismatch');
      }

      // Verify signature using the stored public key
      if (!verifySignature(decryptedBuffer, document.signature, document.publicKey)) {
        throw new Error('Document signature verification failed');
      }

      return {
        buffer: decryptedBuffer,
        filename: document.filename,
        mimeType: document.mimeType,
      };
    } catch (error) {
      console.error('Error downloading document:', error);
      throw new Error(`Error downloading document: ${error.message}`);
    }
  }

  async checkAccess(document, userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.log(`Access denied: User ID ${userId} not found`);
        return false;
      }

      // Grant access to any APPROVED user
      if (user.state === 'APPROVED') {
        console.log(`Access granted: User ID ${userId} is APPROVED`);
        return true;
      }

      console.log(`Access denied: User ID ${userId} is not APPROVED (state: ${user.state})`);
      return false;
    } catch (error) {
      console.error('Error checking document access:', error);
      return false;
    }
  }
}

module.exports = new DocumentService();
