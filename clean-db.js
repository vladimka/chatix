const { MongoClient } = require('mongodb');

// Настройки по умолчанию
const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = 'chatapp';

// Парсим аргументы командной строки
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    uri: DEFAULT_MONGODB_URI,
    db: DEFAULT_DB_NAME,
    confirm: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--uri':
      case '-u':
        options.uri = args[++i];
        break;
      case '--db':
      case '-d':
        options.db = args[++i];
        break;
      case '--confirm':
        options.confirm = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        console.error(`Неизвестный аргумент: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

// Функция для интерактивного подтверждения
async function askConfirmation(collections, dbName) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  ВНИМАНИЕ: Это действие удалит ВСЕ коллекции в базе данных!');
    console.log(`   База данных: ${dbName}`);
    console.log(`   Коллекций к удалению: ${collections.length}\n`);
    
    console.log('Список коллекций:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    rl.question('\nВы уверены, что хотите продолжить? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

function showHelp() {
  console.log(`
MongoDB Cleanup Tool v2.0
Очищает все коллекции в указанной базе данных.

Использование:
  node clean-db.js [options]

Параметры:
  -u, --uri <uri>       URI подключения к MongoDB (по умолчанию: mongodb://localhost:27017)
  -d, --db <name>       Имя базы данных (по умолчанию: chatapp)
  --confirm             Пропустить запрос подтверждения (осторожно!)
  --dry-run             Показать, что будет удалено, без фактического удаления
  -h, --help            Показать эту справку

Примеры:
  node clean-db.js                              # Запросить подтверждение
  node clean-db.js --confirm                    # Удалить без подтверждения (опасно!)
  node clean-db.js --dry-run                    # Проверить, что будет удалено
  node clean-db.js --uri mongodb://127.0.0.1:27018 --mydb
`);
}

async function cleanDatabase(options) {
  console.log('🚀 MongoDB Cleanup Tool v2.0');
  console.log('='.repeat(50));
  
  console.log(`🔧 Конфигурация:`);
  console.log(`   - URI: ${options.uri}`);
  console.log(`   - База данных: ${options.db}`);
  console.log(`   - Dry-run: ${options.dryRun ? 'ВКЛ' : 'ВЫКЛ'}`);
  console.log('='.repeat(50) + '\n');
  
  const client = new MongoClient(options.uri);
  
  try {
    console.log('⏳ Подключаемся к MongoDB...');
    await client.connect();
    console.log('✅ Подключено');
    
    const db = client.db(options.db);
    
    // Получаем список всех коллекций
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️  База данных уже пуста (нет коллекций)');
      return;
    }
    
    console.log(`📊 Найдено коллекций: ${collections.length}\n`);
    
    // Показываем список коллекций
    console.log('📋 Список коллекций:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');
    
    // В dry-run режиме только показываем
    if (options.dryRun) {
      console.log('🔍 DRY-RUN режим: коллекции НЕ будут удалены');
      console.log('   Для реального удаления запустите без --dry-run');
      return;
    }
    
    // Запрашиваем подтверждение если нужно
    if (!options.confirm) {
      const confirmed = await askConfirmation(collections, options.db);
      if (!confirmed) {
        console.log('❌ Операция отменена пользователем');
        return;
      }
    } else {
      console.log('⚠️  Флаг --confirm установлен, пропускаем подтверждение');
    }
    
    console.log('\n🗑️  Удаляем коллекции...');
    
    // Удаляем каждую коллекцию
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const collection of collections) {
      try {
        await db.collection(collection.name).drop();
        console.log(`   ✅ Удалена: ${collection.name}`);
        deletedCount++;
            } catch (err) {
        // Игнорируем ошибку если коллекция уже удалена
        if (err.code === 26) { // NamespaceNotFound
          console.log(`   ⚠️  Коллекция уже удалена: ${collection.name}`);
        } else {
          console.log(`   ❌ Ошибка при удалении ${collection.name}: ${err.message}`);
          errorCount++;
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
    
    console.log(`\n📊 Статистика:`);
    console.log(`   - Удалено коллекций: ${deletedCount}`);
    console.log(`   - Ошибок: ${errorCount}`);
    
    const stats = await db.stats();
    console.log(`   - Размер базы: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Оставшихся коллекций: ${stats.collections}`);
    console.log(`   - Индексов: ${stats.indexes}`);
    
  } catch (error) {
    console.error('\n❌ Критическая ошибка:');
    console.error('   ', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Убедитесь что MongoDB запущена:');
      console.error('   - Windows: net start MongoDB');
      console.error('   - Или запустите mongod вручную');
    }
    
    if (error.message.includes('Authentication failed')) {
      console.error('\n💡 Ошибка аутентификации. Проверьте:');
      console.error('   - Правильность логина/пароля в URI');
      console.error('   - Настройки доступа в MongoDB');
    }
    
    process.exit(1);
  } finally {
    // Закрываем соединение
    await client.close();
    console.log('\n🔌 Соединение с MongoDB закрыто');
    console.log('='.repeat(50));
  }
}

// === ТОЧКА ВХОДА ===
const options = parseArgs();

if (options.help) {
  showHelp();
  process.exit(0);
}

// Запускаем очистку
cleanDatabase(options).catch(err => {
  console.error('❌ Неожиданная ошибка:', err);
  process.exit(1);
});
