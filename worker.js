const fileQueue = require('./utils/fileQueue');
const dbClient = require('./utils/db');
const imageThumbnail = require('image-thumbnail');
const path = require('path');
const fs = require('fs').promises;

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  try {
    const fileObjectId = dbClient.ObjectID(fileId);
    const userObjectId = dbClient.ObjectID(userId);

    const file = await dbClient.db.collection('files').findOne({
      _id: fileObjectId,
      userId: userObjectId,
    });

    if (!file) {
      return done(new Error('File not found'));
    }

    if (file.type !== 'image') {
      return done(new Error('File is not of type image'));
    }

    if (!file.localPath) {
      return done(new Error('File localPath not found'));
    }

    const sizes = [500, 250, 100];

    for (const size of sizes) {
      const options = {
        width: size,
        responseType: 'buffer',
      };

      try {
        const thumbnail = await imageThumbnail(file.localPath, options);
        const ext = path.extname(file.name);
        const baseName = path.basename(file.localPath);

        const thumbnailPath = path.join(
          path.dirname(file.localPath),
          `${baseName}_${size}${ext}`
        );

        await fs.writeFile(thumbnailPath, thumbnail);
        console.log(`Thumbnail created at ${thumbnailPath}`);
      } catch (thumbError) {
        console.error(`Error generating thumbnail of size ${size} for file ${fileId}:`, thumbError);
      }
    }

    return done();
  } catch (err) {
    console.error('Error processing job:', err);
    return done(err);
  }
});

fileQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await fileQueue.close();
  process.exit(0);
});
