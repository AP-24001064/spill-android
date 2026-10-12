import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, Pressable, View, Alert } from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { createClient, Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
);
const button = { backgroundColor: '#27272a', padding: 13, borderRadius: 12, marginVertical: 6 } as const;
const white = { color: 'white', fontWeight: '600' as const, textAlign: 'center' as const };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dump, setDump] = useState('');
  const [memories, setMemories] = useState<any[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'dump'|'memory'|'ask'>('dump');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function auth(signUp: boolean) {
    const result = signUp
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) Alert.alert('Authentication', result.error.message);
    else if (signUp && !result.data.session) Alert.alert('Check your email', 'Confirm your email, then sign in.');
  }

  async function startRecording() {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return Alert.alert('Microphone permission needed');
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function submitDump() {
    if (!dump.trim() && !recorder.uri) return Alert.alert('Add a text dump or record audio first.');
    setBusy(true);
    try {
      let audioPath: string | null = null;
      if (recorder.uri) {
        const path = `${session!.user.id}/${Date.now()}.m4a`;
        const response = await fetch(recorder.uri);
        const blob = await response.blob();
        const upload = await supabase.storage.from('dumps-audio').upload(path, blob, { contentType: 'audio/m4a', upsert: false });
        if (upload.error) throw upload.error;
        audioPath = path;
      }
      const { data, error } = await supabase.functions.invoke('process-dump', { body: { text: dump.trim(), audioPath } });
      if (error) throw error;
      Alert.alert('Saved', `Organized into ${data?.count ?? 0} memory items.`);
      setDump('');
      await loadMemories();
    } catch (e: any) { Alert.alert('Could not process dump', e.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function loadMemories() {
    const { data, error } = await supabase.from('memories').select('id,kind,title,content,due_at,created_at').order('created_at', { ascending: false }).limit(100);
    if (error) Alert.alert('Memory', error.message); else setMemories(data ?? []);
  }

  async function ask() {
    setBusy(true); setAnswer('');
    try {
      const { data, error } = await supabase.functions.invoke('ask-memory', { body: { question } });
      if (error) throw error;
      setAnswer(data?.answer ?? 'No answer returned.');
    } catch (e: any) { Alert.alert('Ask SPILL', e.message ?? 'Could not search memory.'); }
    finally { setBusy(false); }
  }

  if (!session) return <SafeAreaView style={{ flex:1, padding:24, justifyContent:'center', gap:10, backgroundColor:'#fafafa' }}>
    <Text style={{ fontSize:36, fontWeight:'800', color:'#18181b' }}>SPILL</Text>
    <Text style={{ color:'#52525b', marginBottom:16 }}>Dump it now. Find it when you need it.</Text>
    <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={{ backgroundColor:'white', padding:14, borderRadius:12 }} />
    <TextInput secureTextEntry placeholder="Password (min 6 characters)" value={password} onChangeText={setPassword} style={{ backgroundColor:'white', padding:14, borderRadius:12 }} />
    <Pressable style={button} onPress={() => auth(false)}><Text style={white}>Sign in</Text></Pressable>
    <Pressable style={button} onPress={() => auth(true)}><Text style={white}>Create account</Text></Pressable>
  </SafeAreaView>;

  return <SafeAreaView style={{ flex:1, backgroundColor:'#fafafa' }}>
    <View style={{ padding:20, paddingBottom:8 }}>
      <Text style={{ fontSize:30, fontWeight:'800', color:'#18181b' }}>SPILL</Text>
      <Text style={{ color:'#71717a' }}>Your second brain, without the ceremony.</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:14 }}>
        {(['dump','memory','ask'] as const).map(t => <Pressable key={t} onPress={() => { setTab(t); if(t==='memory') loadMemories(); }} style={{ ...button, flex:1, backgroundColor:tab===t?'#52525b':'#e4e4e7' }}><Text style={{ color:tab===t?'white':'#27272a', textAlign:'center', fontWeight:'600' }}>{t==='dump'?'Dump':t==='memory'?'Memory':'Ask'}</Text></Pressable>)}
      </View>
    </View>
    <ScrollView contentContainerStyle={{ padding:20, paddingTop:8 }}>
      {tab==='dump' && <>
        <Text style={{ fontSize:22, fontWeight:'700', marginBottom:10 }}>Get it out of your head.</Text>
        <TextInput multiline placeholder="Brain dump here… tasks, ideas, random thoughts, reminders." value={dump} onChangeText={setDump} textAlignVertical="top" style={{ minHeight:160, backgroundColor:'white', padding:16, borderRadius:16, borderWidth:1, borderColor:'#e4e4e7', fontSize:16 }} />
        <Pressable style={button} onPress={recState.isRecording ? async () => { await recorder.stop(); } : startRecording}><Text style={white}>{recState.isRecording?'Stop recording':'Record a voice dump'}</Text></Pressable>
        {recorder.uri ? <Text style={{ color:'#52525b', marginVertical:6 }}>Audio recorded and ready to submit.</Text> : null}
        <Pressable disabled={busy} style={{ ...button, backgroundColor:'#7c3aed', marginTop:12 }} onPress={submitDump}><Text style={white}>{busy?'Processing…':'Finish & organize'}</Text></Pressable>
      </>}
      {tab==='memory' && <>
        <Text style={{ fontSize:22, fontWeight:'700', marginBottom:10 }}>Your saved memories</Text>
        <Pressable style={button} onPress={loadMemories}><Text style={white}>Refresh</Text></Pressable>
        {memories.map(m => <View key={m.id} style={{ backgroundColor:'white', padding:14, borderRadius:14, marginVertical:5, borderWidth:1, borderColor:'#e4e4e7' }}><Text style={{ color:'#7c3aed', fontSize:12, fontWeight:'700' }}>{m.kind.toUpperCase()}</Text><Text style={{ fontWeight:'700', fontSize:17, marginTop:4 }}>{m.title}</Text><Text style={{ color:'#52525b', marginTop:4 }}>{m.content}</Text>{m.due_at ? <Text style={{ marginTop:6 }}>Due: {new Date(m.due_at).toLocaleDateString()}</Text> : null}</View>)}
        {!memories.length ? <Text style={{ color:'#71717a', marginTop:10 }}>No memories yet. Add your first dump.</Text> : null}
      </>}
      {tab==='ask' && <>
        <Text style={{ fontSize:22, fontWeight:'700', marginBottom:10 }}>Ask your past self.</Text>
        <TextInput multiline placeholder="What did I need to finish this week?" value={question} onChangeText={setQuestion} style={{ minHeight:90, backgroundColor:'white', padding:16, borderRadius:16, borderWidth:1, borderColor:'#e4e4e7' }} />
        <Pressable disabled={busy || !question.trim()} style={button} onPress={ask}><Text style={white}>{busy?'Searching…':'Ask SPILL'}</Text></Pressable>
        {answer ? <View style={{ backgroundColor:'white', padding:16, borderRadius:16, marginTop:10 }}><Text style={{ fontWeight:'700', marginBottom:6 }}>From your memory</Text><Text style={{ lineHeight:22 }}>{answer}</Text></View> : null}
      </>}
      <Pressable onPress={() => supabase.auth.signOut()} style={{ padding:12, marginTop:22 }}><Text style={{ textAlign:'center', color:'#71717a' }}>Sign out</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}
