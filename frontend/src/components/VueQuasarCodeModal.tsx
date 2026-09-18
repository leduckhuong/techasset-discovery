import React, { useState } from 'react';
import { Copy, Check, Code2, Download, ExternalLink, X } from 'lucide-react';
import { QBtn } from './QuasarUiElements';

interface VueQuasarCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VueQuasarCodeModal: React.FC<VueQuasarCodeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState<'template' | 'script' | 'full'>('full');

  if (!isOpen) return null;

  const fullVueQuasarCode = `<template>
  <!-- Quasar QLayout Structure for TechAsset Discovery Scanner -->
  <q-layout view="lHh Lpr lFf" class="bg-grey-1">
    <!-- Quasar QHeader -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="drawerOpen = !drawerOpen"
        />

        <q-toolbar-title class="row items-center q-gutter-sm">
          <q-avatar size="32px" color="white" text-color="primary" icon="radar" />
          <div class="text-weight-bold">TechAsset Scanner</div>
          <q-badge color="teal" label="Tech Engine v2.0" />
        </q-toolbar-title>

        <q-btn flat round dense icon="code" @click="openSourceDialog" />
        <q-btn flat round dense icon="dark_mode" @click="$q.dark.toggle()" />
      </q-toolbar>
    </q-header>

    <!-- Quasar QDrawer Left Navigation -->
    <q-drawer v-model="drawerOpen" show-if-above bordered class="bg-white">
      <q-scroll-area class="fit">
        <q-list padding class="text-grey-8">
          <q-item-label header class="text-weight-bold text-uppercase text-grey-6 text-caption">
            Quản lý Tài sản số
          </q-item-label>

          <q-item clickable v-ripple :active="activeTab === 'scanner'" @click="activeTab = 'scanner'">
            <q-item-section avatar>
              <q-icon name="search" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Quét Tech Stack</q-item-label>
              <q-item-label caption>Nhận diện tech stack</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple :active="activeTab === 'assets'" @click="activeTab = 'assets'">
            <q-item-section avatar>
              <q-icon name="dns" color="teal" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Kho Tài sản Công nghệ</q-item-label>
              <q-item-label caption>{{ assets.length }} targets</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge color="primary" :label="assets.length" />
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple :active="activeTab === 'terminal'" @click="activeTab = 'terminal'">
            <q-item-section avatar>
              <q-icon name="terminal" color="positive" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Scanner CLI Live</q-item-label>
              <q-item-label caption>Terminal stdout</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator spaced />

          <q-item-label header class="text-weight-bold text-caption">
            Mục tiêu mẫu (Presets)
          </q-item-label>
          <q-item
            v-for="(preset, i) in presets"
            :key="i"
            clickable
            v-ripple
            dense
            @click="loadPreset(preset)"
          >
            <q-item-section>
              <q-item-label class="text-body2">{{ preset.name }}</q-item-label>
              <q-item-label caption>{{ preset.urls.length }} URLs</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Quasar QPageContainer -->
    <q-page-container>
      <q-page class="q-pa-md">
        <!-- Input & Options Card -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold row items-center justify-between">
              <span>Danh sách URL Mục tiêu</span>
              <q-badge outline color="primary" :label="\`\${parsedUrls.length} targets\`" />
            </div>

            <q-input
              v-model="urlsInput"
              type="textarea"
              outlined
              dense
              rows="4"
              placeholder="https://quasar.dev&#10;https://vuejs.org&#10;https://github.com"
              class="q-mt-sm font-mono"
            />

            <!-- Scanner Flag Toggles -->
            <div class="row q-gutter-md q-mt-sm items-center">
              <q-checkbox v-model="flags.techDetect" label="-tech-detect" color="primary" dense />
              <q-checkbox v-model="flags.statusCode" label="-status-code" color="primary" dense />
              <q-checkbox v-model="flags.title" label="-title" color="primary" dense />
              <q-checkbox v-model="flags.followRedirects" label="-follow-redirects" color="primary" dense />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn
              unelevated
              color="primary"
              icon="play_arrow"
              :loading="scanning"
              label="Bắt đầu quét Tech Asset"
              @click="startScan"
            />
          </q-card-actions>
        </q-card>

        <!-- Quasar QTable for Tech Assets -->
        <q-card flat bordered>
          <q-table
            title="Tài sản Công nghệ Đã Quét"
            :rows="filteredAssets"
            :columns="columns"
            row-key="id"
            :filter="filterSearch"
            :pagination="{ rowsPerPage: 10 }"
          >
            <template v-slot:top-right>
              <q-input
                outlined
                dense
                debounce="300"
                v-model="filterSearch"
                placeholder="Tìm URL hoặc công nghệ..."
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </template>

            <!-- Custom Status Code Slot -->
            <template v-slot:body-cell-statusCode="props">
              <q-td :props="props">
                <q-chip
                  dense
                  :color="getStatusColor(props.value)"
                  text-color="white"
                  class="text-weight-bold"
                >
                  {{ props.value }}
                </q-chip>
              </q-td>
            </template>

            <!-- Custom Technologies Chips Slot -->
            <template v-slot:body-cell-technologies="props">
              <q-td :props="props">
                <div class="row q-gutter-xs">
                  <q-chip
                    v-for="tech in props.value"
                    :key="tech.name"
                    dense
                    outline
                    color="primary"
                    :label="tech.name"
                  />
                </div>
              </q-td>
            </template>
          </q-table>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const drawerOpen = ref(true)
const activeTab = ref('assets')
const scanning = ref(false)
const filterSearch = ref('')
const urlsInput = ref('https://quasar.dev\\nhttps://vuejs.org')

const flags = ref({
  techDetect: true,
  statusCode: true,
  title: true,
  followRedirects: true,
  threads: 5,
  timeout: 5
})

interface TechAsset {
  id: string
  url: string
  host: string
  statusCode: number
  title: string
  technologies: { name: string; category: string }[]
  webServer: string
  responseTimeMs: number
  ip: string
}

const assets = ref<TechAsset[]>([])

const columns = [
  { name: 'statusCode', label: 'HTTP Status', field: 'statusCode', sortable: true, align: 'left' },
  { name: 'host', label: 'Mục tiêu (Host)', field: 'host', sortable: true, align: 'left' },
  { name: 'title', label: 'Tiêu đề Trang', field: 'title', align: 'left' },
  { name: 'technologies', label: 'Công nghệ phát hiện', field: 'technologies', align: 'left' },
  { name: 'webServer', label: 'Máy chủ Web', field: 'webServer', sortable: true, align: 'left' },
  { name: 'responseTimeMs', label: 'Phản hồi', field: 'responseTimeMs', sortable: true, align: 'right' }
]

const parsedUrls = computed(() => {
  return urlsInput.value.split('\\n').map(u => u.trim()).filter(Boolean)
})

function getStatusColor(code: number) {
  if (code >= 200 && code < 300) return 'positive'
  if (code >= 300 && code < 400) return 'primary'
  if (code >= 400 && code < 500) return 'warning'
  return 'negative'
}

async function startScan() {
  if (parsedUrls.value.length === 0) return
  scanning.value = true
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: parsedUrls.value, options: flags.value })
    })
    const data = await res.json()
    assets.value = data.results
    $q.notify({
      type: 'positive',
      message: \`Quét thành công \${data.results.length} tài sản công nghệ\`
    })
  } catch (err: any) {
    $q.notify({ type: 'negative', message: 'Lỗi: ' + err.message })
  } finally {
    scanning.value = false
  }
}
<\/script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullVueQuasarCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullVueQuasarCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TechAssetDiscoveryScanner.vue';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl q-shadow-3 border border-slate-300 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-[#1976D2] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Vue 3 + Quasar Single File Component (SFC)</h3>
              <p className="text-xs text-blue-100">
                Mã nguồn chuẩn Quasar Framework 2.x &amp; Vue 3 Composition API cho ứng dụng này
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Tệp:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-[#1976D2]">
              src/pages/TechAssetDiscoveryScanner.vue
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-600 font-bold">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1976D2] hover:bg-[#1565C0] text-white font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải tệp .vue</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#0d1117] text-slate-100 font-mono text-xs leading-relaxed select-text">
          <pre>
            <code>{fullVueQuasarCode}</code>
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Tương thích: <span className="font-semibold text-slate-700">Quasar CLI, Vite Quasar Plugin, Vue 3.4+</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
