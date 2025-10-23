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

/**
 * canSend（计算属性）
 * 功能：判断当前输入框内容是否满足发送条件。
 * 逻辑：
 * - 对 draft 去除首尾空白后检查长度是否 > 0；
 * - 返回布尔值以控制“发送”按钮禁用态与回车发送逻辑。
 */
const canSend = computed(() => draft.value.trim().length > 0)

/**
 * nl2br(s = '')
 * 功能：将纯文本中的换行符转换为 HTML 的 <br/> 标签，便于在 v-html 中正确换行展示。
 * 逻辑：
 * - 将输入强制转为字符串；
 * - 使用正则全局替换所有 \n 为 <br/>；
 * - 返回转换后的字符串。
 */
function nl2br(s='') {
  return String(s).replace(/\n/g, '<br/>')
}

/**
 * scrollToBottom()
 * 功能：将消息滚动容器滚动到最底部，保证最新消息可见。
 * 逻辑：
 * - 使用 nextTick 等待 DOM 更新完成后再操作滚动条；
 * - 读取 threadEl 的 DOM 节点，如果存在则将 scrollTop 设为 scrollHeight；
 * - try/catch 防御潜在的 DOM 读取异常。
 */
function scrollToBottom() {
  nextTick(() => {
    try {
      const el = threadEl.value
      if (el) el.scrollTop = el.scrollHeight
    } catch {}
  })
}

/**
 * clearChat()
 * 功能：清空当前会话消息与错误提示。
 * 逻辑：
 * - 将 messages 置为空数组；
 * - 将 errorMsg 置空，恢复无错误状态。
 */
function clearChat() {
  messages.value = []
  errorMsg.value = ''
}

/**
 * enterToSend(e)
 * 功能：处理输入框的回车行为——区分换行与发送。
 * 逻辑：
 * - 若按下的是 Shift+Enter，则不发送，仅用于换行（直接 return）；
 * - 否则调用 send() 执行发送流程。
 */
function enterToSend(e) {
  // Shift+Enter -> 换行；纯 Enter -> 发送
  if (e.shiftKey) return
  send()
}

/**
 * send()
 * 功能：发送当前输入消息到后端（通过云函数转发到 AI 模型），并将对话结果加入消息列表。
 * 逻辑：
 * 1) 读取并裁剪 draft，若为空或正在发送中(sending=true)则直接返回；
 * 2) 清空 errorMsg，将用户消息立即 push 到 messages 展示；清空输入框、置 sending=true 并滚动到底；
 * 3) 构造 history：取 messages 的“历史部分”（除去刚推入的最后一条用户消息），并将 role 规范化为 'user'/'model'；
 * 4) 调用 Firebase Functions：httpsCallable('aiSupportChat')，传入 { prompt, history }；
 * 5) 解析返回：
 *    - 若 data.ok 且存在 data.reply，将 AI 回复 push 到 messages；
 *    - 否则设置 errorMsg，并追加一条兜底提示消息；
 * 6) 捕获异常：记录控制台错误、设置 errorMsg，并追加兜底提示消息；
 * 7) finally：无论成功失败都将 sending 复位为 false，并再次滚动到底部，确保最新消息可见。
 */
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
    // 仅把“历史”传过去（不含刚刚输入的用户消息，取其之前的消息作为上下文）
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
