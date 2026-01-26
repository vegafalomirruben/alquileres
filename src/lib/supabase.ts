//import { createClient } from '@supabase/supabase-js'

//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
//const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

//export const supabase = createClient(supabaseUrl, supabaseAnonKey)

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("-----------------------------------------");
console.log("VALOR URL:", url ? "Detectada ✅" : "VACÍA ❌");
console.log("VALOR KEY:", key ? "Detectada ✅" : "VACÍA ❌");
console.log("-----------------------------------------");

if (!url || !key) {
    throw new Error(`Error de Configuración: URL=${url}, KEY=${key}`);
}

export const supabase = createClient(url, key)
