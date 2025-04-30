import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import nftRoutes from './routes/nftRoutes.js';
import { swaggerDocs } from './swagger/swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Use routes for NFT minting and transactions
app.use('/api/nfts', nftRoutes);

// Swagger Documentation Route
app.use('/api-docs', swaggerDocs());

// Root route for checking server status
app.get('/', (req, res) => {
  res.send({ status: 'NFT minting server is running' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
