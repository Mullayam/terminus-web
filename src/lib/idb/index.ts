/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB, IDBPDatabase } from 'idb';

const IDB_NAME = 'terminus-web-idb';
const STORE_NAME = 'myStore';


// Define the structure of the database schema
interface MyDBSchema extends IDBDatabase { 
    id:number,
    test:string
}

// Singleton pattern to ensure only one instance of the database connection
let dbPromise: Promise<IDBPDatabase<MyDBSchema>> | null = null;

// Initialize the database
const initDB = async (): Promise<IDBPDatabase<MyDBSchema>> => {
    if (!dbPromise) {
        dbPromise = openDB<MyDBSchema>(IDB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

// Add data to the store
export const addData = async  <T extends Record<string, any>>(id:string,dataItem: T): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.add({
        id,
        ...dataItem
    });
    await tx.done;
};

// Retrieve all data from the store
export const getAllData = async  <T extends Record<string, any>>(): Promise<T[]> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return await tx.store.getAll();
};

// Retrieve a single item by ID
export const getDataById = async <T extends Record<string, any>>(id: number): Promise<T | undefined> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return await tx.store.get(id);
};

// Update data by ID
export const updateData = async <T extends Record<string, any>>(dataItem: T,key:string): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.put(dataItem,key);
    await tx.done;
};

// Delete data by ID
export const deleteData = async (id: number): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.delete(id);
    await tx.done;
};
