const { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const BUCKET_NAME = "smart-cctv-recordings"; 

const streamToS3 = async (stream, s3Key, mimeType = 'video/webm') => {
    try {
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: stream,
                ContentType: mimeType
            },
            partSize: 5 * 1024 * 1024
        });
        await upload.done();
        return true;
    } catch (err) {
        console.error("[S3] Streaming Error:", err.message);
        return false;
    }
};

const renameS3Object = async (oldKey, newKey, contentType = 'video/webm') => {
    try {
        await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${oldKey}`,
            Key: newKey,
            ContentType: contentType,
            MetadataDirective: 'REPLACE' 
        }));
        await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: oldKey }));
        
        // Return clean URL: https://bucket.s3.region.amazonaws.com/folder/file.webm
        return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${newKey}`;
    } catch (err) {
        console.error("[S3] Rename Error:", err.message);
        return null;
    }
};

const listRecordings = async () => {
    try {
        const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'recordings/' });
        const response = await s3Client.send(command);
        if (!response.Contents) return [];

        return response.Contents
            .filter(item => item.Size > 0 && (item.Key.endsWith('.mp4') || item.Key.endsWith('.webm')))
            .map(item => ({
                filename: item.Key.split('/').pop(),
                // Constructing the URL manually to avoid character encoding issues
                url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${item.Key}`,
                size: item.Size,
                lastModified: item.LastModified
            }))
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    } catch (error) {
        console.error("[S3] List Error:", error);
        return [];
    }
};

module.exports = { streamToS3, renameS3Object, listRecordings };