
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dufdnegmajwsahlzesvj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZmRuZWdtYWp3c2FobHplc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzAxODcsImV4cCI6MjA4MjA0NjE4N30.YCpHYmWIZ3pIoQHRP4NB0rMfvRm_s9SCl__s2Rj5_mk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
