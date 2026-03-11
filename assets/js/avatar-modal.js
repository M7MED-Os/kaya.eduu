// ============================================
// Avatar Selection Modal
// ============================================
// دالة واحدة نظيفة لفتح Modal اختيار الأفاتار
// تشتغل للطلاب والشلل
// ============================================

import { supabase } from './supabaseClient.js';
import { generateAvatarOptions } from './avatars.js';
import { showToast } from './utils.js';

/**
 * فتح Modal لاختيار الأفاتار
 * @param {string} type - 'user' أو 'squad'
 * @param {string} entityId - ID الطالب أو الشلة
 * @param {string} entityName - اسم الطالب أو الشلة
 * @param {function} onSuccess - Callback بعد النجاح
 */
export async function openAvatarModal(type = 'user', entityId, entityName, onSuccess) {
    const isSquad = type === 'squad';
    const title = isSquad ? 'اختر صورة الشلة' : 'اختر صورتك الشخصية';

    // توليد الأفاتارات الجاهزة
    const avatarOptions = generateAvatarOptions(entityName, 12);

    let selectedAvatar = null;
    let uploadedFile = null;

    const { value: result } = await Swal.fire({
        title: title,
        html: `
            <div style="text-align: center;">
                <!-- Tabs -->
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; justify-content: center;">
                    <button id="presetTab" class="avatar-modal-tab active" style="
                        padding: 0.75rem 1.5rem;
                        background: none;
                        border: none;
                        color: var(--primary-color);
                        font-weight: 600;
                        cursor: pointer;
                        border-bottom: 3px solid var(--primary-color);
                    ">
                        <i class="fas fa-images"></i> أفاتارات جاهزة
                    </button>
                    <button id="uploadTab" class="avatar-modal-tab" style="
                        padding: 0.75rem 1.5rem;
                        background: none;
                        border: none;
                        color: #64748b;
                        font-weight: 600;
                        cursor: pointer;
                        border-bottom: 3px solid transparent;
                    ">
                        <i class="fas fa-upload"></i> رفع صورة
                    </button>
                </div>

                <!-- Tab Content: Preset Avatars -->
                <div id="presetContent" style="display: block;">
                    <div id="avatarGrid" style="
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 0.75rem;
                        max-height: 400px;
                        overflow-y: auto;
                        padding: 0.5rem;
                    ">
                        ${avatarOptions.map(opt => `
                            <div class="avatar-option" data-url="${opt.url}" style="
                                cursor: pointer;
                                border: 3px solid transparent;
                                border-radius: 12px;
                                padding: 0.5rem;
                                transition: all 0.3s;
                                background: #f8fafc;
                                position: relative;
                            ">
                                <img src="${opt.url}" style="
                                    width: 100%;
                                    height: 80px;
                                    object-fit: cover;
                                    border-radius: 8px;
                                ">
                                <div class="check-icon" style="
                                    position: absolute;
                                    top: 5px;
                                    right: 5px;
                                    background: var(--primary-color);
                                    color: white;
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    display: none;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 0.75rem;
                                ">
                                    <i class="fas fa-check"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Tab Content: Upload -->
                <div id="uploadContent" style="display: none;">
                    <div id="uploadArea" style="
                        border: 2px dashed #cbd5e1;
                        border-radius: 12px;
                        padding: 3rem;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        <input type="file" id="fileInput" accept="image/*" style="display: none;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">اضغط لرفع صورة</p>
                        <p style="color: #64748b; font-size: 0.9rem;">JPG, PNG أو GIF (أقصى حجم: 2MB)</p>
                    </div>
                    <div id="uploadPreview" style="display: none; margin-top: 1rem;">
                        <img id="uploadedImage" style="max-width: 200px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ الصورة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#03A9F4',
        width: '600px',
        didOpen: () => {
            // Tab switching
            const presetTab = document.getElementById('presetTab');
            const uploadTab = document.getElementById('uploadTab');
            const presetContent = document.getElementById('presetContent');
            const uploadContent = document.getElementById('uploadContent');

            presetTab.addEventListener('click', () => {
                presetTab.classList.add('active');
                uploadTab.classList.remove('active');
                presetTab.style.color = 'var(--primary-color)';
                presetTab.style.borderBottomColor = 'var(--primary-color)';
                uploadTab.style.color = '#64748b';
                uploadTab.style.borderBottomColor = 'transparent';
                presetContent.style.display = 'block';
                uploadContent.style.display = 'none';
            });

            uploadTab.addEventListener('click', () => {
                uploadTab.classList.add('active');
                presetTab.classList.remove('active');
                uploadTab.style.color = 'var(--primary-color)';
                uploadTab.style.borderBottomColor = 'var(--primary-color)';
                presetTab.style.color = '#64748b';
                presetTab.style.borderBottomColor = 'transparent';
                uploadContent.style.display = 'block';
                presetContent.style.display = 'none';
            });

            // Avatar selection
            document.querySelectorAll('.avatar-option').forEach(el => {
                el.addEventListener('click', () => {
                    document.querySelectorAll('.avatar-option').forEach(opt => {
                        opt.style.borderColor = 'transparent';
                        opt.querySelector('.check-icon').style.display = 'none';
                    });
                    el.style.borderColor = 'var(--primary-color)';
                    el.querySelector('.check-icon').style.display = 'flex';
                    selectedAvatar = el.dataset.url;
                    uploadedFile = null;
                });
            });

            // File upload
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');

            uploadArea.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > 2 * 1024 * 1024) {
                    showToast('الصورة كبيرة جداً! الحد الأقصى 2MB', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('uploadedImage').src = e.target.result;
                    document.getElementById('uploadPreview').style.display = 'block';
                    uploadedFile = file;
                    selectedAvatar = null;
                };
                reader.readAsDataURL(file);
            });
        },
        preConfirm: () => {
            if (!selectedAvatar && !uploadedFile) {
                Swal.showValidationMessage('اختر صورة أولاً!');
                return false;
            }
            return { selectedAvatar, uploadedFile };
        }
    });

    if (result) {
        await saveAvatar(type, entityId, result.selectedAvatar, result.uploadedFile, onSuccess);
    }
}

/**
 * ضغط الصورة وتصغير حجمها قبل الرفع
 * @param {File} file - الملف الأصلي
 * @returns {Promise<Blob>} - الصورة المضغوطة
 */
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // أقصى عرض أو طول 400px
                const MAX_SIZE = 400;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // تحويل لـ Blob بجودة 0.7
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

/**
 * حفظ الأفاتار في قاعدة البيانات
 */
async function saveAvatar(type, entityId, avatarUrl, file, onSuccess) {
    try {
        Swal.fire({
            title: 'جاري الحفظ...',
            text: file ? 'يتم ضغط الصورة ورفعها...' : 'جاري التحديث...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let finalUrl = avatarUrl;

        // لو في ملف مرفوع، نرفعه على Storage
        if (file) {
            // 1. ضغط الصورة أولاً
            const compressedBlob = await compressImage(file);

            const fileExt = 'jpg'; // دايماً بنحول لـ jpg بعد الضغط
            const fileName = `${type}-${entityId}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressedBlob, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            finalUrl = publicUrl;
        }

        // تحديث قاعدة البيانات
        const table = type === 'squad' ? 'squads' : 'profiles';
        const { error: updateError } = await supabase
            .from(table)
            .update({ avatar_url: finalUrl })
            .eq('id', entityId);

        if (updateError) throw updateError;

        Swal.fire({
            icon: 'success',
            title: 'تم الحفظ بنجاح! 🎉',
            showConfirmButton: false,
            timer: 1500
        });

        if (onSuccess) onSuccess(finalUrl);

    } catch (error) {
        console.error(error);
        Swal.fire('خطأ', 'حصل خطأ في الحفظ', 'error');
    }
}
