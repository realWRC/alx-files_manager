const uuid = require('uuid');
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs').promises;
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    const {
      name, type, parentId = '0', isPublic = false, data,
    } = req.body;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const redisKey = `auth_${token}`;
      const userId = await redisClient.get(redisKey);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await dbClient.db.collection('users').findOne({ _id: dbClient.ObjectID(userId) });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Missing name' });
      }

      const validTypes = ['folder', 'file', 'image'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }

      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      if (type === 'folder' && data) {
        return res.status(400).json({ error: 'Data should not be provided for folders' });
      }

      if (parentId !== '0') {
        let parentObjectId;
        try {
          parentObjectId = dbClient.ObjectID(parentId);
        } catch (err) {
          return res.status(400).json({ error: 'Invalid parentId format' });
        }

        const parent = await dbClient.db.collection('files').findOne({ _id: parentObjectId });

        if (!parent) {
          return res.status(400).json({ error: 'Parent not found' });
        }

        if (parent.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }

      let localPath = null;

      if (type === 'file' || type === 'image') {
        const folderPath = '/tmp/files_manager';
        await mkdirp.sync(folderPath);

        const fileUUID = uuid.v4();
        localPath = path.join(folderPath, fileUUID);

        const fileBuffer = Buffer.from(data, 'base64');

        await fs.writeFile(localPath, fileBuffer);
      }

      const fileDoc = {
        userId: dbClient.ObjectID(userId),
        name,
        type,
        isPublic: Boolean(isPublic),
        parentId: parentId === '0' ? '0' : dbClient.ObjectID(parentId),
      };

      if (type === 'file' || type === 'image') {
        fileDoc.localPath = localPath;
      }

      const result = await dbClient.db.collection('files').insertOne(fileDoc);

      const responseFile = {
        id: result.insertedId.toString(),
        userId,
        name,
        type,
        isPublic: Boolean(isPublic),
        parentId: parentId === '0' ? '0' : parentId,
      };

      if (type === 'file' || type === 'image') {
        responseFile.localPath = localPath;
      }

      return res.status(201).json(responseFile);
    } catch (error) {
      console.error('Error in postUpload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
