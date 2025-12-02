// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, query, orderByKey, startAt, endAt } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Helper para converter chaves (Firebase não permite ":" em paths)
const toFirebaseKey = (key) => key.replace(/:/g, '_');
const fromFirebaseKey = (key) => key.replace(/_/g, ':');

// Adapta a API para ser compatível com window.storage
const firebaseStorage = {
  async get(key) {
    try {
      const firebaseKey = toFirebaseKey(key);
      const dbRef = ref(database, firebaseKey);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Retorna como string JSON para compatibilidade com o App (que faz JSON.parse)
        return {
          key: key,
          value: typeof data === 'object' ? JSON.stringify(data) : data,
          shared: false
        };
      }
      return null;
    } catch (error) {
      console.error('Erro ao ler do Firebase:', error);
      throw error;
    }
  },

  async set(key, value) {
    try {
      const firebaseKey = toFirebaseKey(key);
      const dbRef = ref(database, firebaseKey);
      // Converte string JSON para objeto antes de salvar no Firebase
      // Isso permite que o Firebase armazene como estrutura de dados real
      const dataToSave = typeof value === 'string' ? JSON.parse(value) : value;
      await set(dbRef, dataToSave);
      return {
        key: key,
        value: value,
        shared: false
      };
    } catch (error) {
      console.error('Erro ao salvar no Firebase:', error);
      throw error;
    }
  },

  async delete(key) {
    try {
      const firebaseKey = toFirebaseKey(key);
      const dbRef = ref(database, firebaseKey);
      await remove(dbRef);
      return {
        key: key,
        deleted: true,
        shared: false
      };
    } catch (error) {
      console.error('Erro ao deletar do Firebase:', error);
      throw error;
    }
  },

  async list(prefix = '') {
    try {
      const dbRef = ref(database);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const firebasePrefix = toFirebaseKey(prefix);
        // Filtra por prefixo convertido e retorna chaves no formato original
        const keys = Object.keys(data)
          .filter(key => key.startsWith(firebasePrefix))
          .map(key => fromFirebaseKey(key));
        return {
          keys: keys,
          prefix: prefix,
          shared: false
        };
      }
      
      return {
        keys: [],
        prefix: prefix,
        shared: false
      };
    } catch (error) {
      console.error('Erro ao listar do Firebase:', error);
      throw error;
    }
  }
};

// Adiciona ao window para compatibilidade
if (typeof window !== 'undefined') {
  window.storage = firebaseStorage;
}

export default firebaseStorage;