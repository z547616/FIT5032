<template>
  <div class="card border-0 shadow-sm mt-4">
    <div class="card-header bg-white">
      <strong>Wellness Chat (AI by Gemini)</strong>
    </div>

    <div class="card-body">
      <div class="wc-thread" ref="threadEl">
        <div
          v-for="(m,i) in messages"
          :key="i"
          class="wc-msg"
          :class="m.role === 'user' ? 'wc-user' : 'wc-bot'"
        >
          <div class="wc-bubble">
            <div class="small text-muted mb-1">
              {{ m.role === 'user' ? 'You' : 'MindBloom AI' }}
            </div>
            <div v-html="nl2br(m.text)"></div>
          </div>
        </div>

        <div v-if="sending" class="wc-msg wc-bot">
          <div class="wc-bubble small text-muted">
            Thinking…
          </div>
        </div>
      </div>

      <div class="mt-3">
        <textarea
          v-model="draft"
          class="form-control"
          rows="3"
          placeholder="Tell me how you're feeling. Shift+Enter for newline, Enter to send."
          @keydown.enter.prevent="enterToSend"
          @keydown.shift.enter.stop
        ></textarea>

        <div class="d-flex justify-content-between align-items-center mt-2">
          <div class="small text-muted" v-if="errorMsg">{{ errorMsg }}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" @click="clearChat" :disabled="sending || messages.length===0">
              Clear
            </button>
            <button class="btn btn-primary btn-sm" @click="send" :disabled="sending || !canSend">
              {{ sending ? 'Sending...' : 'Send' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { functions } from '../../firebase'
import { httpsCallable } from 'firebase/functions'

const messages = ref([
  {
    role: 'model',
    text: "Hi! I'm here to listen. How are you feeling today? 💬"
  }
])
const draft = ref('')
const sending = ref(false)
const errorMsg = ref('')
const threadEl = ref(null)

const canSend = computed(() => draft.value.trim().length > 0)

function nl2br(s='') {
  return String(s).replace(/\n/g, '<br/>')
}
function scrollToBottom() {
  nextTick(() => {
    try {
      const el = threadEl.value
      if (el) el.scrollTop = el.scrollHeight
    } catch {}
  })
}
function clearChat() {
  messages.value = []
  errorMsg.value = ''
}

function enterToSend(e) {
  // Shift+Enter -> 换行；纯 Enter -> 发送
  if (e.shiftKey) return
  send()
}

async function send() {
  const prompt = draft.value.trim()
  if (!prompt || sending.value) return
  errorMsg.value = ''

  // 先推入用户消息
  messages.value.push({ role: 'user', text: prompt })
  draft.value = ''
  sending.value = true
  scrollToBottom()

  try {
    // 仅把“历史”传过去（不含刚刚输入的用户消息？—— 我们包含它之前的历史）
    const history = messages.value.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text
    }))

    const call = httpsCallable(functions, 'aiSupportChat')
    const resp = await call({ prompt, history })   // 👈 关键：带上 prompt 与 history

    const data = resp?.data || {}
    if (data.ok && data.reply) {
      messages.value.push({ role: 'model', text: data.reply })
    } else {
      // 后端返回的错误信息（例如 missing prompt）会走这里
      errorMsg.value = data.error || 'AI service error. Please try again.'
      messages.value.push({
        role: 'model',
        text: "I'm having trouble connecting right now. Please try again in a moment."
      })
    }
  } catch (e) {
    console.error('[WellnessChat] failed', e)
    errorMsg.value = 'AI error'
    messages.value.push({
      role: 'model',
      text: "I'm having trouble connecting right now. Please try again in a moment."
    })
  } finally {
    sending.value = false
    scrollToBottom()
  }
}
</script>

<style scoped>
.wc-thread {
  max-height: 360px;
  overflow: auto;
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}
.wc-msg { display: flex; margin-bottom: 10px; }
.wc-user { justify-content: flex-end; }
.wc-bot  { justify-content: flex-start; }
.wc-bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 8px rgba(0,0,0,.06);
  font-size: 14px;
  line-height: 1.45;
}
.wc-user .wc-bubble { background: #e8f1ff; }
</style>
