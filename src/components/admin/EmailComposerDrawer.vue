<template>
  <!-- Overlay -->
  <div class="ec-overlay" @click.self="handleClose">
    <!-- Drawer -->
    <div class="ec-drawer card shadow-lg">
      <div class="card-header d-flex align-items-center justify-content-between">
        <h5 class="mb-0">Compose Email</h5>
        <button class="btn btn-sm btn-outline-secondary" @click="handleClose">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="card-body">
        <!-- Recipients -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Recipients</label>
          <div class="d-flex flex-wrap gap-2">
            <span
              v-for="(r, i) in recipients"
              :key="(r.email || '') + i"
              class="badge rounded-pill text-bg-secondary"
              title="Recipient"
            >
              {{ displayRecipient(r) }}
            </span>
          </div>
          <div class="form-text">{{ recipients.length }} recipient(s)</div>
        </div>

        <!-- Subject -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Subject</label>
          <input
            v-model.trim="form.subject"
            type="text"
            class="form-control"
            placeholder="Subject"
            maxlength="180"
          />
        </div>

        <!-- Text -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Text (Plain)</label>
          <textarea
            v-model.trim="form.text"
            class="form-control"
            rows="4"
            placeholder="Email plain text content"
          ></textarea>
          <div class="form-text">
            Provide either <strong>Text</strong> or <strong>HTML</strong>.
          </div>
        </div>

        <!-- HTML -->
        <div class="mb-3">
          <label class="form-label fw-semibold">HTML (Optional)</label>
          <textarea
            v-model.trim="form.html"
            class="form-control"
            rows="4"
            placeholder="HTML content (optional)"
          ></textarea>
        </div>

        <!-- Attachments -->
        <div class="mb-3">
          <label class="form-label fw-semibold">Attachments (Optional)</label>
          <input
            ref="fileInput"
            type="file"
            class="form-control"
            multiple
            @change="onPickFiles"
          />
          <ul class="list-unstyled mt-2 small" v-if="form.attachments.length">
            <li
              v-for="(a, i) in form.attachments"
              :key="a.name + i"
              class="d-flex justify-content-between align-items-center border rounded p-2 mb-2"
            >
              <div class="text-truncate pe-2">
                <i class="bi bi-paperclip me-2"></i>
                <strong>{{ a.name }}</strong>
                <span class="text-muted">({{ a.mimeType || 'application/octet-stream' }})</span>
              </div>
              <button
                class="btn btn-sm btn-outline-danger"
                title="Remove attachment"
                @click="removeAttachment(i)"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </li>
          </ul>
        </div>

        <!-- Alerts -->
        <div v-if="err" class="alert alert-danger py-2">{{ err }}</div>
        <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>
      </div>

      <div class="card-footer d-flex justify-content-end gap-2">
        <button class="btn btn-outline-secondary" :disabled="sending" @click="confirmClose">
          Close
        </button>
        <button class="btn btn-primary" :disabled="!canSend || sending" @click="sendEmail">
          <span v-if="sending" class="spinner-border spinner-border-sm me-2"></span>
          {{ sending ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { db } from '../../firebase'
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

/** Props & Emits */
const props = defineProps({
  recipients: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'sent'])

/* ---------- State ---------- */
const form = ref({
  subject: '',
  text: '',
  html: '',
  attachments: []
})

const sending = ref(false)
const err = ref('')
const okMsg = ref('')
const fileInput = ref(null)

/* ---------- Helpers ---------- */
/**
 * displayRecipient(r)
 * 功能：将收件人的显示名称按优先级格式化输出。
 * 逻辑：
 * 1) 若对象为空，返回 'Unknown'；
 * 2) 优先使用 r.name（非空白）；
 * 3) 其次使用 r.username（非空白）；
 * 4) 再次使用 r.email（非空白）；
 * 5) 都不可用则返回 'Unknown'。
 */
function displayRecipient (r) {
  if (!r) return 'Unknown'
  if (r.name && String(r.name).trim()) return r.name
  if (r.username && String(r.username).trim()) return r.username
  if (r.email && String(r.email).trim()) return r.email
  return 'Unknown'
}

/**
 * canSend（计算属性）
 * 功能：判断是否满足发送邮件的必要条件。
 * 逻辑：
 * 1) 至少有一个有效的收件人（props.recipients 数组非空）；
 * 2) 主题非空（form.subject 去空白后非空字符串）；
 * 3) 正文必须提供纯文本 text 或 HTML 至少其一（去空白后非空）。
 */
const canSend = computed(() => {
  const hasRecipients = Array.isArray(props.recipients) && props.recipients.length > 0
  const hasSubject = !!form.value.subject.trim()
  const hasBody = !!form.value.text.trim() || !!form.value.html.trim()
  return hasRecipients && hasSubject && hasBody
})

/**
 * handleClose()
 * 功能：关闭弹窗。
 * 逻辑：直接通过 emit('close') 通知父组件。
 */
function handleClose () { emit('close') }

/**
 * confirmClose()
 * 功能：带确认的关闭弹窗，避免误关丢失输入内容。
 * 逻辑：
 * 1) 若表单任一字段（subject/text/html/attachments）非空，则弹出确认框；
 * 2) 用户取消则不关闭；确认后或表单为空则调用 handleClose()。
 */
function confirmClose () {
  if (form.value.subject || form.value.text || form.value.html || form.value.attachments.length) {
    if (!window.confirm('Close without sending? Your inputs will be discarded.')) return
  }
  handleClose()
}

/**
 * removeAttachment(i)
 * 功能：移除第 i 个附件。
 * 逻辑：索引在合法范围内则使用 splice 删除该附件。
 */
function removeAttachment (i) {
  if (i >= 0 && i < form.value.attachments.length) form.value.attachments.splice(i, 1)
}

/**
 * onPickFiles(e)
 * 功能：处理文件选择事件，把文件读入并转换为附件对象后加入表单。
 * 逻辑：
 * 1) 从 input 事件中取出 File 列表，若为空直接返回；
 * 2) 清空错误消息，批量调用 fileToAttachment 转 base64；
 * 3) 转换成功将附件数组 push 到 form.attachments；
 * 4) 出错时记录错误信息，控制台打印异常；
 * 5) 最后重置文件输入框的值，便于重复选择相同文件。
 */
async function onPickFiles (e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  err.value = ''
  try {
    const converted = await Promise.all(files.map(fileToAttachment))
    form.value.attachments.push(...converted)
  } catch (ex) {
    console.error('[EmailComposer] file convert error', ex)
    err.value = 'Failed to read attachments.'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

/**
 * readAsDataURL(file)
 * 功能：以 DataURL（base64 编码）形式异步读取文件内容。
 * 逻辑：
 * - 封装 FileReader 为 Promise；
 * - onload 解析结果，onerror 拒绝；
 * - readAsDataURL 以便后续提取 base64 部分。
 */
function readAsDataURL (file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

/**
 * fileToAttachment(file)
 * 功能：将 File 转为邮件附件对象。
 * 逻辑：
 * 1) 调用 readAsDataURL 读取文件并得到 dataURL；
 * 2) 从 dataURL 中分离出逗号后的 base64 字符串；
 * 3) 返回包含 name、mimeType、contentBase64 三字段的附件对象；
 * 4) 若无类型信息则回退为 'application/octet-stream'。
 */
async function fileToAttachment (file) {
  const dataUrl = await readAsDataURL(file)
  const base64 = String(dataUrl).split(',')[1] || ''
  return { name: file.name, mimeType: file.type || 'application/octet-stream', contentBase64: base64 }
}

/* ---------- Send Email ---------- */
/**
 * sendEmail()
 * 功能：将邮件发送任务写入 Firestore 队列（mail_jobs），由后端/云函数异步实际发送。
 * 逻辑：
 * 1) 前置校验：若不满足 canSend 或处于发送中状态，直接返回；
 * 2) 进入发送态：sending=true，清空 err/okMsg；
 * 3) 获取当前管理员信息（Firebase Auth），提取 uid/email；
 * 4) 优先从 Firestore 的 users/{uid} 获取 username；若无则回退为 displayName，再无则取 email 前缀，最后默认 'Administrator'；
 * 5) 规整收件人列表：只保留有 email 的项，并携带 name（name 或 username）；
 * 6) 若无有效收件人，提示错误并结束；
 * 7) 向 mail_jobs 集合写入任务文档：状态 queued、时间戳、主题、正文（text/html）、收件人、附件、以及创建者信息（createdBy + createdByInfo）；
 * 8) 成功后设置 okMsg 提示，同时通过 setTimeout 触发 emit('sent') 并关闭对话框，增强用户体验；
 * 9) 捕获错误并写入 err 供 UI 展示；
 * 10) finally 中将 sending 复位为 false。
 */
async function sendEmail () {
  if (!canSend.value || sending.value) return
  sending.value = true
  err.value = ''
  okMsg.value = ''

  try {
    // 当前管理员信息
    const auth = getAuth()
    const user = auth.currentUser
    const byUid = user && user.uid ? user.uid : null
    const byEmail = user && user.email ? user.email : ''

    // 从 users/{uid} 取 username（优先），否则回落到 displayName 或 email 前缀
    let byUsername = ''
    if (byUid) {
      try {
        const snap = await getDoc(doc(db, 'users', byUid))
        if (snap && snap.exists()) {
          const d = snap.data() || {}
          if (typeof d.username === 'string' && d.username.trim()) {
            byUsername = d.username.trim()
          }
        }
      } catch (_) {}
    }
    if (!byUsername) {
      const displayName = user && user.displayName ? user.displayName : ''
      if (displayName) byUsername = displayName
      else if (byEmail) byUsername = byEmail.split('@')[0]
      else byUsername = 'Administrator'
    }

    // 收件人整理
    const recipients = props.recipients
      .map((r) => ({
        email: String(r && r.email ? r.email : '').trim(),
        name: String(r && (r.name || r.username) ? (r.name || r.username) : '').trim()
      }))
      .filter((r) => r.email)

    if (!recipients.length) {
      err.value = 'No valid recipient emails.'
      sending.value = false
      return
    }

    console.log('[EmailComposer] queue job recipients:', recipients)

    // ✅ 写入 createdBy 为字符串（管理员 email），确保 Admin.vue 现有模板可直接显示
    // ✅ 同时写入 createdByInfo（对象）以保存 uid/email/username 三项信息
    const ref = await addDoc(collection(db, 'mail_jobs'), {
      status: 'queued',
      createdAt: serverTimestamp(),
      subject: form.value.subject.trim(),
      text: form.value.text.trim(),
      html: form.value.html.trim(),
      recipients,
      attachments: form.value.attachments,
      createdBy: byEmail, // ← Admin 列表可直接显示
      createdByInfo: {
        uid: byUid,
        email: byEmail,
        username: byUsername
      }
    })

    console.log('[EmailComposer] job created:', ref.id)
    okMsg.value = 'Queued successfully. Emails will be sent shortly.'
    setTimeout(() => {
      emit('sent')
      handleClose()
    }, 600)
  } catch (e) {
    console.error('[EmailComposer] create mail job failed', e)
    err.value = e && e.message ? e.message : 'Failed to queue email job.'
  } finally {
    sending.value = false
  }
}
</script>


<style scoped>
.ec-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  place-items: center;
  padding: 16px;
}

/* Drawer panel */
.ec-drawer {
  width: min(760px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.ec-drawer .card-body {
  overflow: auto;
}
</style>
