<template>
  <div class="container py-4">
    <h2 class="mb-4 text-center text-primary">🌱 Anonymous Stories</h2>

    <div v-for="story in stories" :key="story.id" class="card shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title text-secondary">Anonymous</h5>
        <p class="card-text">{{ story.content }}</p>

        <!-- 平均评分 + 当前用户评分 -->
        <div class="mb-2 d-flex flex-column">
          <div>
            <strong>Average Rating: </strong>
            <span class="text-warning">
              {{ getAverage(story) }} ⭐ ({{ story.ratings.length }} votes)
            </span>
          </div>

          <div v-if="userRating(story.id) > 0 && !editingStory[story.id]" class="text-muted small d-flex align-items-center gap-2">
            Your rating: {{ userRating(story.id).toFixed(1) }} ⭐
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" @click="startEdit(story.id)">✏</button>
          </div>
        </div>

        <!-- 星星评分 -->
        <div class="mb-3 rating-stars"
             :class="{ editing: editingStory[story.id] }"
             @mouseleave="hoverRatings[story.id] = 0">
          <div
            v-for="i in 5"
            :key="i"
            class="star"
            @mousemove="editingStory[story.id] && updateHover(story.id, i, $event)"
            @click="editingStory[story.id] && confirmRating(story.id, i)"
          >
            <div
              class="star-fill"
              :style="{ '--fill': calcFill(i, story) }"
            >★</div>
          </div>
        </div>

        <!-- 评论区 -->
        <div class="mb-3">
          <h6 class="fw-bold">Comments</h6>
          <ul class="list-group mb-2">
            <li
              v-for="(c, index) in story.comments"
              :key="index"
              class="list-group-item"
            >
              <strong>{{ c.user }}:</strong> {{ c.text }}
            </li>
            <li
              v-if="!story.comments.length"
              class="list-group-item text-muted"
            >
              No comments yet.
            </li>
          </ul>
          <div class="input-group">
            <input
              v-model="newComments[story.id]"
              class="form-control"
              placeholder="Add a comment..."
            />
            <button
              class="btn btn-outline-primary"
              @click="addComment(story.id)"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { sanitizeInput } from '../utils/sanitize.js'



const currentUser = localStorage.getItem('currentUser') || 'Guest'

// 每个故事独立的悬停评分状态与编辑状态
const hoverRatings = reactive({})
const editingStory = reactive({})

const stories = reactive([
  {
    id: 's1',
    content: 'I struggled with anxiety for years, but talking to someone helped me get better.',
    ratings: [],
    comments: [],
  },
  {
    id: 's2',
    content: 'University life was stressful, but I learned to set small goals and celebrate small wins.',
    ratings: [],
    comments: [],
  },
  {
    id: 's3',
    content: 'Writing down my thoughts in a diary really helped me calm down during tough days.',
    ratings: [],
    comments: [],
  },
])

const newComments = reactive({})

// 初始化：从 localStorage 载入历史评分/评论
onMounted(() => {
  const saved = JSON.parse(localStorage.getItem('stories') || '[]')
  if (saved.length) {
    saved.forEach(savedStory => {
      const target = stories.find(s => s.id === savedStory.id)
      if (target) {
        target.ratings = savedStory.ratings || []
        target.comments = savedStory.comments || []
      }
    })
  }
})

function saveStories() {
  localStorage.setItem('stories', JSON.stringify(stories))
}

function userRating(storyId) {
  const story = stories.find(s => s.id === storyId)
  const r = story.ratings.find(r => r.user === currentUser)
  return r ? r.score : 0
}

function updateHover(storyId, starIndex, e) {
  const half = e.offsetX < e.currentTarget.offsetWidth / 2 ? 0.5 : 1
  hoverRatings[storyId] = (starIndex - 1) + half
}

function confirmRating(storyId, starIndex) {
  const score = hoverRatings[storyId]
  const story = stories.find(s => s.id === storyId)
  const existing = story.ratings.find(r => r.user === currentUser)
  if (existing) {
    existing.score = score
  } else {
    story.ratings.push({ user: currentUser, score })
  }
  saveStories()
  editingStory[storyId] = false
}

function getAverage(story) {
  if (!story.ratings.length) return '0.0'
  const sum = story.ratings.reduce((acc, r) => acc + r.score, 0)
  return (sum / story.ratings.length).toFixed(1)
}

function addComment(storyId) {
  let text = newComments[storyId]
  text = sanitizeInput(text, 200)
  if (!text) return
  const story = stories.find((s) => s.id === storyId)
  story.comments.push({ user: currentUser, text })
  newComments[storyId] = ''
  saveStories()
}

function calcFill(i, story) {
  const current = hoverRatings[story.id] || userRating(story.id)
  const fill = Math.min(Math.max(current - (i - 1), 0), 1)
  return (fill * 100) + '%'
}

function startEdit(storyId) {
  const story = stories.find(s => s.id === storyId)
  // 移除当前用户的原评分
  story.ratings = story.ratings.filter(r => r.user !== currentUser)
  saveStories()
  // 进入编辑模式并重置为灰色
  editingStory[storyId] = true
  hoverRatings[storyId] = 0
}
</script>

<style scoped>
.card {
  border: none;
  border-radius: 12px;
}

.card-body {
  padding: 1.5rem;
}

.rating-stars {
  display: flex;
  gap: 6px;
  width: 160px; /* 限定为5颗星的宽度 */
}

.star {
  font-size: 32px;
  cursor: pointer;
  line-height: 1;
}

.star-fill {
  display: inline-block;
  color: #ccc;
  background: linear-gradient(
    to right,
    #ffc107 var(--fill, 0%),
    #ccc var(--fill, 0%)
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: transform 0.2s;
}

.star-fill:hover {
  transform: scale(1.1);
}
</style>
