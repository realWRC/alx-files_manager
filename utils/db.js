const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}`;

    this.client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    this.client.connect()
      .then(() => {
        console.log('Connected to MongoDB successfully');
      })
      .catch((err) => {
        console.error('Failed to connect to MongoDB:', err);
      });

    this.db = this.client.db(database);
  }

  isAlive() {
    return this.client && this.client.isConnected();
  }

  async nbUsers() {
    try {
      const count = await this.db.collection('users').countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting users:', err);
      return null;
    }
  }

  async nbFiles() {
    try {
      const count = await this.db.collection('files').countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting files:', err);
      return null;
    }
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
