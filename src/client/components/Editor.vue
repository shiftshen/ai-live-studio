<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
export interface Field {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  min?: number;
  max?: number;
}
const p = defineProps<{
  title: string;
  value: Record<string, any>;
  fields: Field[];
  busy: boolean;
  error: string;
}>();
const emit = defineEmits<{ save: [value: Record<string, any>]; close: [] }>();
const data = ref({ ...p.value });
const panel = ref<HTMLElement>();
function save() {
  const out = { ...data.value };
  for (const f of p.fields) {
    if (f.type === "list")
      out[f.key] = String(out[f.key] || "")
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (f.type === "number") out[f.key] = Number(out[f.key]);
  }
  emit("save", out);
}
for (const f of p.fields)
  if (f.type === "list" && Array.isArray(data.value[f.key]))
    data.value[f.key] = data.value[f.key].join(", ");
function key(e: KeyboardEvent) {
  if (e.key === "Escape" && !p.busy) emit("close");
  if (e.key === "Tab") {
    const a = panel.value?.querySelectorAll<HTMLElement>(
      "button,input,select,textarea",
    );
    if (!a?.length) return;
    const first = a[0],
      last = a[a.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
onMounted(() => {
  panel.value
    ?.querySelector<HTMLElement>("input,select,textarea,button")
    ?.focus();
  document.addEventListener("keydown", key);
});
onUnmounted(() => document.removeEventListener("keydown", key));
</script>
<template>
  <div class="modal-backdrop">
    <section
      ref="panel"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-title"
    >
      <header>
        <h2 id="editor-title">{{ title }}</h2>
        <button aria-label="关闭" :disabled="busy" @click="emit('close')">
          ×
        </button>
      </header>
      <form @submit.prevent="save">
        <div class="form-grid">
          <label
            v-for="f in fields"
            :key="f.key"
            :class="{ wide: f.type === 'textarea' }"
            ><span>{{ f.label }}</span>
            <div v-if="f.type === 'checklist'" class="checklist">
              <label v-for="o in f.options" :key="o.value" class="check-label"
                ><input
                  v-model="data[f.key]"
                  type="checkbox"
                  :value="o.value"
                />{{ o.label }}</label
              >
            </div>
            <textarea
              v-else-if="f.type === 'textarea'"
              v-model="data[f.key]"
              :required="f.required"
              rows="4"
            /><select v-else-if="f.options" v-model="data[f.key]">
              <option v-for="o in f.options" :key="o.value" :value="o.value">
                {{ o.label }}
              </option></select
            ><input
              v-else-if="f.type === 'checkbox'"
              v-model="data[f.key]"
              type="checkbox"
            /><input
              v-else
              v-model="data[f.key]"
              :type="f.type === 'list' ? 'text' : f.type || 'text'"
              :required="f.required"
              :min="f.min"
              :max="f.max"
              step="any"
            /><small v-if="f.hint">{{ f.hint }}</small></label
          >
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" :disabled="busy" @click="emit('close')">
            取消</button
          ><button class="primary" :disabled="busy">
            {{ busy ? "保存中…" : "保存配置" }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>
