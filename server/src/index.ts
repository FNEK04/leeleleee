import express from 'express';
import cors from 'cors';
// Временно закомментируем импорт для тестирования
// import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Простой тестовый маршрут
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

// Временно закомментируем использование роутов
// app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 