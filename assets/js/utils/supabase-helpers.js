/**
 * Supabase Helper Utilities
 * Wraps common Supabase operations with error handling
 */

import { supabase } from '../supabaseClient.js';

/**
 * Executes a Supabase query with standardized error handling
 * @param {Promise} queryPromise - Supabase query promise
 * @param {string} errorContext - Context for error logging (optional)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function executeQuery(queryPromise, errorContext = '') {
    try {
        const { data, error } = await queryPromise;

        if (error) {
            console.error(`[Supabase Error] ${errorContext}:`, error);
        }

        return { data, error };
    } catch (err) {
        console.error(`[Supabase Exception] ${errorContext}:`, err);
        return { data: null, error: err };
    }
}

/**
 * Fetches data from a table with error handling
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @param {string} options.select - Columns to select (default: '*')
 * @param {Object} options.filters - Filters to apply (e.g., { id: 'xxx' })
 * @param {string} options.orderBy - Column to order by
 * @param {boolean} options.ascending - Order direction (default: true)
 * @param {number} options.limit - Limit results
 * @param {boolean} options.single - Return single row
 * @returns {Promise<{data: any, error: any}>}
 */
export async function fetchFromTable(table, options = {}) {
    const {
        select = '*',
        filters = {},
        orderBy = null,
        ascending = true,
        limit = null,
        single = false
    } = options;

    let query = supabase.from(table).select(select);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
    });

    // Apply ordering
    if (orderBy) {
        query = query.order(orderBy, { ascending });
    }

    // Apply limit
    if (limit) {
        query = query.limit(limit);
    }

    // Single row
    if (single) {
        query = query.single();
    }

    return executeQuery(query, `fetchFromTable(${table})`);
}

/**
 * Updates a record in a table
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<{data: any, error: any}>}
 */
export async function updateRecord(table, id, updates) {
    const query = supabase
        .from(table)
        .update(updates)
        .eq('id', id);

    return executeQuery(query, `updateRecord(${table}, ${id})`);
}

/**
 * Inserts a record into a table
 * @param {string} table - Table name
 * @param {Object} record - Record to insert
 * @returns {Promise<{data: any, error: any}>}
 */
export async function insertRecord(table, record) {
    const query = supabase
        .from(table)
        .insert(record);

    return executeQuery(query, `insertRecord(${table})`);
}

/**
 * Deletes a record from a table
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @returns {Promise<{data: any, error: any}>}
 */
export async function deleteRecord(table, id) {
    const query = supabase
        .from(table)
        .delete()
        .eq('id', id);

    return executeQuery(query, `deleteRecord(${table}, ${id})`);
}

/**
 * Calls a Supabase RPC function
 * @param {string} functionName - RPC function name
 * @param {Object} params - Function parameters
 * @returns {Promise<{data: any, error: any}>}
 */
export async function callRPC(functionName, params = {}) {
    const query = supabase.rpc(functionName, params);

    return executeQuery(query, `callRPC(${functionName})`);
}

/**
 * Uploads a file to Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @param {File} file - File to upload
 * @returns {Promise<{data: any, error: any}>}
 */
export async function uploadFile(bucket, path, file) {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file);

        if (error) {
            console.error(`[Storage Error] uploadFile(${bucket}/${path}):`, error);
        }

        return { data, error };
    } catch (err) {
        console.error(`[Storage Exception] uploadFile(${bucket}/${path}):`, err);
        return { data: null, error: err };
    }
}

/**
 * Gets public URL for a file in storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {string} - Public URL
 */
export function getPublicURL(bucket, path) {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return data?.publicUrl || '';
}

/**
 * Deletes a file from storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {Promise<{data: any, error: any}>}
 */
export async function deleteFile(bucket, path) {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error(`[Storage Error] deleteFile(${bucket}/${path}):`, error);
        }

        return { data, error };
    } catch (err) {
        console.error(`[Storage Exception] deleteFile(${bucket}/${path}):`, err);
        return { data: null, error: err };
    }
}
