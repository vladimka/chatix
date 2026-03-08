const { MongoClient } = require('mongodb');

// Настройки подключения
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'chatapp';

async function cleanDatabase() {
  console.log('🧹 Начинаем очистку базы данных...');
  console.log('='.repeat(50));
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Подключаемся к MongoDB
    await client.connect();
    console.log('✅ Подключено к MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Получаем список всех коллекций
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️ База данных уже пуста (нет коллекций)');
    } else {
      console.log(`📊 Найдено коллекций: ${collections.length}`);
      console.log('\n📋 Список коллекций:');
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
      
      console.log('\n🗑️  Удаляем коллекции...');
      
      // Удаляем каждую коллекцию
      for (const collection of collections) {
        try {
          await db.collection(collection.name).drop();
          console.log(`   ✅ Удалена коллекция: ${collection.name}`);
        } catch (err) {
          console.log(`   ❌ Ошибка при удалении ${collection.name}:`, err.message);
        }
      }
    }
    
    // Проверяем результат
    const remainingCollections = await db.listCollections().toArray();
    
    console.log('\n' + '='.repeat(50));
    if (remainingCollections.length === 0) {
      console.log('✅ База данных полностью очищена!');
    } else {
      console.log(`⚠️  Осталось коллекций: ${remainingCollections.length}`);
      remainingCollections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }
    
    // Показываем статистику
    const stats = await db.stats();
    console.log('\n📊 Статистика базы данных:');
    console.log(`   - Размер: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Коллекций: ${stats.collections}`);
    console.log(`   - Индексов: ${stats.indexes}`);
    
  } catch (error) {
    console.error('\n❌ Ошибка при очистке базы данных:');
    console.error('   ', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Убедитесь что MongoDB запущена:');
      console.error('   - Windows: net start MongoDB');
      console.error('   - Или запустите mongod вручную');
    }
  } finally {
    // Закрываем соединение
    await client.close();
    console.log('\n🔌 Соединение с MongoDB закрыто');
  }
}

// Запускаем очистку
console.log('🚀 MongoDB Cleanup Tool');
console.log('='.repeat(50));
cleanDatabase();