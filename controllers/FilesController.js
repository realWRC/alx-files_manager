const uuid = require('uuid');
const mkdirp = require('mkdirp');
const mime = require('mime-types');
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
        if (!type) {
          return res.status(400).json({ error: 'Missing type' });
        }
        return res.status(400).json({ error: 'Invalid type' });
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
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
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
        parentId: parentId === '0' ? '0' : parentId.toString(),
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

  static async getShow(req, res) {
    const { id } = req.params;
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

      let fileObjectId;
      try {
        fileObjectId = dbClient.ObjectID(id);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      const file = await dbClient.db.collection('files').findOne({
        _id: fileObjectId,
        userId: dbClient.ObjectID(userId),
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      const responseFile = {
        id: file._id.toString(),
        userId: file.userId.toString(),
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId === '0' ? '0' : file.parentId.toString(),
      };

      if (file.type === 'file' || file.type === 'image') {
        responseFile.localPath = file.localPath;
      }

      return res.status(200).json(responseFile);
    } catch (error) {
      console.error('Error in getShow:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const { parentId = '0', page = '0' } = req.query;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pageNumber = parseInt(page, 10);
    if (Number.isNaN(pageNumber) || pageNumber < 0) {
      return res.status(400).json({ error: 'Invalid page number' });
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

      let parentCondition;
      if (parentId === '0') {
        parentCondition = '0';
      } else {
        try {
          parentCondition = dbClient.ObjectID(parentId);
        } catch (err) {
          return res.status(200).json([]);
        }
      }

      const limit = 20;
      const skip = pageNumber * limit;

      const query = {
        userId: dbClient.ObjectID(userId),
        parentId: parentCondition,
      };

      const filesCursor = dbClient.db.collection('files').find(query).skip(skip).limit(limit);
      const files = await filesCursor.toArray();

      const responseFiles = files.map((file) => {
        const mappedFile = {
          id: file._id.toString(),
          userId: file.userId.toString(),
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId === '0' ? '0' : file.parentId.toString(),
        };
        if (file.type === 'file' || file.type === 'image') {
          mappedFile.localPath = file.localPath;
        }
        return mappedFile;
      });

      return res.status(200).json(responseFiles);
    } catch (error) {
      console.error('Error in getIndex:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(req, res) {
    const { id } = req.params;
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

      let fileObjectId;
      try {
        fileObjectId = dbClient.ObjectID(id);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      const updatedFile = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: fileObjectId, userId: dbClient.ObjectID(userId) },
        { $set: { isPublic: true } },
        { returnDocument: 'after' },
      );

      if (!updatedFile.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      const responseFile = {
        id: updatedFile.value._id.toString(),
        userId: updatedFile.value.userId.toString(),
        name: updatedFile.value.name,
        type: updatedFile.value.type,
        isPublic: updatedFile.value.isPublic,
        parentId: updatedFile.value.parentId === '0' ? '0' : updatedFile.value.parentId.toString(),
      };

      if (updatedFile.value.type === 'file' || updatedFile.value.type === 'image') {
        responseFile.localPath = updatedFile.value.localPath;
      }

      return res.status(200).json(responseFile);
    } catch (error) {
      console.error('Error in putPublish:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
    const { id } = req.params;
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

      let fileObjectId;
      try {
        fileObjectId = dbClient.ObjectID(id);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      const updatedFile = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: fileObjectId, userId: dbClient.ObjectID(userId) },
        { $set: { isPublic: false } },
        { returnDocument: 'after' },
      );

      if (!updatedFile.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      const responseFile = {
        id: updatedFile.value._id.toString(),
        userId: updatedFile.value.userId.toString(),
        name: updatedFile.value.name,
        type: updatedFile.value.type,
        isPublic: updatedFile.value.isPublic,
        parentId: updatedFile.value.parentId === '0' ? '0' : updatedFile.value.parentId.toString(),
      };

      if (updatedFile.value.type === 'file' || updatedFile.value.type === 'image') {
        responseFile.localPath = updatedFile.value.localPath;
      }

      return res.status(200).json(responseFile);
    } catch (error) {
      console.error('Error in putUnpublish:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const token = req.headers['x-token'];

    try {
      let fileObjectId;
      try {
        fileObjectId = dbClient.ObjectID(id);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      const file = await dbClient.db.collection('files').findOne({ _id: fileObjectId });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      let isAuthorized = false;

      if (file.isPublic) {
        isAuthorized = true;
      } else if (token) {
        const redisKey = `auth_${token}`;
        const userId = await redisClient.get(redisKey);

        if (userId && userId === file.userId.toString()) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (!file.localPath) {
        return res.status(404).json({ error: 'Not found' });
      }

      try {
        await fs.access(file.localPath);
      } catch (err) {
        return res.status(404).json({ error: 'Not found' });
      }

      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      const fileContent = await fs.readFile(file.localPath);

      res.set('Content-Type', mimeType);

      return res.send(fileContent);
    } catch (error) {
      console.error('Error in getFile:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
