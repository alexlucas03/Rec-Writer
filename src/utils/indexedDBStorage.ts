interface UserInput {
  id: string;
  timestamp: number;
  content: string;
  type: 'student-note' | 'writing-sample' | 'generated-content' | 'sample-analysis';
  teacherName: string;
  metadata?: any; // For storing additional information
}

class IndexedDBStorage {
  private dbName = 'TeacherLLMDatabase';
  private dbVersion = 3; // Incremented version to support metadata
  private db: IDBDatabase | null = null;
  
  constructor() {
    this.initDB();
  }
  
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Could not open IndexedDB');
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('userInputs')) {
          const store = db.createObjectStore('userInputs', { keyPath: 'id' });
          store.createIndex('by_teacher', 'teacherName', { unique: false });
          store.createIndex('by_type', 'type', { unique: false });
          store.createIndex('by_teacher_and_type', ['teacherName', 'type'], { unique: false });
        } else if (event.oldVersion < 2) {
          const transaction = request.transaction;
          
          if (transaction) {
            const store = transaction.objectStore('userInputs');
            
            if (store.indexNames.contains('by_teacher')) {
              store.deleteIndex('by_teacher');
              store.createIndex('by_teacher', 'teacherName', { unique: false });
            }
            if (store.indexNames.contains('by_teacher_and_type')) {
              store.deleteIndex('by_teacher_and_type');
              store.createIndex('by_teacher_and_type', ['teacherName', 'type'], { unique: false });
            }
          } else {
            console.warn('Transaction was null during database upgrade');
          }
        }
        
        // For version 3: Make sure we have the 'by_type' index
        if (event.oldVersion < 3) {
          const transaction = request.transaction;
          
          if (transaction) {
            const store = transaction.objectStore('userInputs');
            
            if (!store.indexNames.contains('by_type')) {
              store.createIndex('by_type', 'type', { unique: false });
            }
          }
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }
  
  async saveUserInput(input: UserInput): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readwrite');
      const store = transaction.objectStore('userInputs');
      const request = store.put(input);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error saving data');
    });
  }
  
  async deleteUserInput(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readwrite');
      const store = transaction.objectStore('userInputs');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('Error deleting data:', event);
        reject('Error deleting data');
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
        console.error('Transaction error during delete:', event);
        reject('Transaction error during delete');
      };
    });
  }
  
  async getAllUserInputs(): Promise<UserInput[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readonly');
      const store = transaction.objectStore('userInputs');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Error getting data');
    });
  }
  
  async getTeacherInputs(teacherName: string): Promise<UserInput[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readonly');
      const store = transaction.objectStore('userInputs');
      const index = store.index('by_teacher');
      const request = index.getAll(IDBKeyRange.only(teacherName));
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Error getting teacher data');
    });
  }
  
  async getTeacherWritingSamples(teacherName: string): Promise<UserInput[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readonly');
      const store = transaction.objectStore('userInputs');
      const index = store.index('by_teacher_and_type');
      const request = index.getAll(IDBKeyRange.only([teacherName, 'writing-sample']));
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Error getting writing samples');
    });
  }
  
  async getTeacherStudentNotes(teacherName: string): Promise<UserInput[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readonly');
      const store = transaction.objectStore('userInputs');
      const index = store.index('by_teacher_and_type');
      const request = index.getAll(IDBKeyRange.only([teacherName, 'student-note']));
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject('Error getting student notes');
    });
  }
  
  async saveTeacherName(teacherName: string): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key: 'teacherName', value: teacherName });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error saving teacher name');
    });
  }
  
  async getTeacherName(): Promise<string | null> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('teacherName');
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject('Error getting teacher name');
    });
  }
  
  async exportAllData(): Promise<string> {
    const data = await this.getAllUserInputs();
    return JSON.stringify(data);
  }
  
  async importData(jsonData: string): Promise<void> {
    try {
      const inputs = JSON.parse(jsonData) as UserInput[];
      if (!Array.isArray(inputs)) throw new Error('Invalid data format');
      
      if (!this.db) await this.initDB();
      const transaction = this.db!.transaction(['userInputs'], 'readwrite');
      const store = transaction.objectStore('userInputs');
      
      store.clear();
      
      for (const input of inputs) {
        store.add(input);
      }
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('Error importing data');
      });
    } catch (e) {
      console.error('Failed to import data:', e);
      throw new Error('Invalid data format');
    }
  }

  async hasCustomModel(teacherName: string): Promise<boolean> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(`customModel_${teacherName}`);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value === true);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject('Error checking custom model status');
    });
  }
  
  // Save the custom model status for a teacher
  async saveCustomModelStatus(teacherName: string, hasModel: boolean): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ 
        key: `customModel_${teacherName}`, 
        value: hasModel 
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Error saving custom model status');
    });
  }

  // NEW METHODS ADDED:

  /**
   * Get all user inputs of a specific type
   */
  async getUserInputsByType(teacherName: string, type: string): Promise<UserInput[]> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readonly');
      const store = transaction.objectStore('userInputs');
      const index = store.index('by_teacher_and_type');
      const request = index.getAll(IDBKeyRange.only([teacherName, type]));
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(`Error getting inputs of type ${type}`);
    });
  }

  /**
   * Update metadata for a specific user input
   */
  async updateUserInputMetadata(id: string, metadata: any): Promise<void> {
    if (!this.db) await this.initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userInputs'], 'readwrite');
      const store = transaction.objectStore('userInputs');
      
      // First get the current record
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (!record) {
          reject(`Record with ID ${id} not found`);
          return;
        }
        
        // Update the metadata
        record.metadata = {
          ...(record.metadata || {}),
          ...metadata
        };
        
        // Put the updated record back
        const putRequest = store.put(record);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (event) => {
          console.error('Error updating metadata:', event);
          reject('Error updating metadata');
        };
      };
      
      getRequest.onerror = (event) => {
        console.error('Error retrieving record for metadata update:', event);
        reject('Error retrieving record for metadata update');
      };
    });
  }
}

export const dbStorage = new IndexedDBStorage();