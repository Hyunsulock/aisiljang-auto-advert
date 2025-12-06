import { useState, useEffect } from 'react';
import { X, Upload, Trash2, Download } from 'lucide-react';
import { Button } from '../ui/button';
import type { PropertyOwnerInfo } from '../../lib/supabase';

interface PropertyOwnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  propertyName: string;
  dong: string | null;
  ho: string | null;
  ownerInfo: PropertyOwnerInfo | null;
  onSave: (data: PropertyOwnerFormData, files: PropertyOwnerFiles) => Promise<void>;
  onDelete: () => Promise<void>;
}

export interface PropertyOwnerFormData {
  ownerType: '개인' | '법인' | '외국인' | '위임장';
}

export interface PropertyOwnerFiles {
  document: File | null; // 서류 (필수)
  powerOfAttorney: File | null; // 위임장 (외국인/위임장 케이스)
}

export function PropertyOwnerDialog({
  isOpen,
  onClose,
  propertyName,
  dong,
  ho,
  ownerInfo,
  onSave,
  onDelete,
}: PropertyOwnerDialogProps) {
  const [formData, setFormData] = useState<PropertyOwnerFormData>({
    ownerType: '개인',
  });

  const [files, setFiles] = useState<PropertyOwnerFiles>({
    document: null,
    powerOfAttorney: null,
  });

  const [existingFiles, setExistingFiles] = useState({
    document: false,
    powerOfAttorney: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);

  // 초기 소유자 타입 저장 (변경 감지용)
  const [initialOwnerType, setInitialOwnerType] = useState<'개인' | '법인' | '외국인' | '위임장'>('개인');

  useEffect(() => {
    if (ownerInfo && ownerInfo.hasOwnerInfo) {
      const ownerType = (ownerInfo.ownerType as '개인' | '법인' | '외국인' | '위임장') || '개인';

      // 기존 데이터 로드
      setFormData({
        ownerType,
      });

      // 초기 소유자 타입 저장
      setInitialOwnerType(ownerType);

      // 기존 파일 정보 설정
      setExistingFiles({
        document: ownerInfo.files.includes('서류'),
        powerOfAttorney: ownerInfo.files.includes('위임장'),
      });

      console.log('[PropertyOwnerDialog] Loaded owner info:', {
        ownerType: ownerInfo.ownerType,
        files: ownerInfo.files,
        filePaths: ownerInfo.filePaths,
      });
    } else {
      // 새로운 소유자 정보 입력 시 초기화
      setFormData({
        ownerType: '개인',
      });
      setInitialOwnerType('개인');
      setExistingFiles({
        document: false,
        powerOfAttorney: false,
      });
    }
  }, [ownerInfo]);

  // 위임장 표시 여부 확인
  const shouldShowPowerOfAttorney = () => {
    return formData.ownerType === '외국인' || formData.ownerType === '위임장';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 서류 파일 체크
    if (!files.document && !existingFiles.document) {
      alert('서류 파일을 업로드해주세요');
      return;
    }

    // 변경 사항 확인: 새 파일이 선택되었거나, 소유자 정보가 없는 경우만 저장
    const hasNewFiles = files.document !== null || files.powerOfAttorney !== null;
    const hasOwnerInfo = ownerInfo?.hasOwnerInfo;

    if (!hasNewFiles && hasOwnerInfo) {
      // 새 파일이 없고 이미 소유자 정보가 있으면 저장하지 않음
      alert('변경된 내용이 없습니다');
      onClose();
      return;
    }

    try {
      setIsSaving(true);
      await onSave(formData, files);
      onClose();
    } catch (error) {
      console.error('Failed to save owner info:', error);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 소유자 정보를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete owner info:', error);
      alert('삭제 중 오류가 발생했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = async (type: 'document' | 'powerOfAttorney') => {
    try {
      const result = await (window as any).propertyOwner.selectFile();

      if (result.success && result.filePath) {
        // 파일 경로를 저장 (Electron의 경우 실제 파일 경로)
        setFiles({
          ...files,
          [type]: { path: result.filePath } as any
        });
      }
    } catch (error) {
      console.error('Failed to select file:', error);
      alert('파일 선택 중 오류가 발생했습니다');
    }
  };

  const handleFileChange = (
    type: 'document' | 'powerOfAttorney',
    file: File | null
  ) => {
    setFiles({ ...files, [type]: file });
  };

  const handleDownloadFile = async (fileType: 'document' | 'powerOfAttorney') => {
    try {
      if (!ownerInfo?.filePaths) {
        alert('파일 정보를 찾을 수 없습니다');
        return;
      }

      let storageFilePath: string | undefined;
      let baseFileName: string;

      switch (fileType) {
        case 'document':
          storageFilePath = ownerInfo.filePaths.document;
          baseFileName = '서류';
          break;
        case 'powerOfAttorney':
          storageFilePath = ownerInfo.filePaths.powerOfAttorney;
          baseFileName = '위임장';
          break;
      }

      if (!storageFilePath) {
        alert('파일 경로를 찾을 수 없습니다');
        return;
      }

      // Storage 경로에서 실제 확장자 추출
      const ext = storageFilePath.substring(storageFilePath.lastIndexOf('.')) || '.pdf';
      const fileName = `${baseFileName}${ext}`;

      const result = await (window as any).propertyOwner.downloadFile(storageFilePath, fileName);

      if (result.success) {
        alert('파일이 다운로드되었습니다');
      } else if (!result.canceled) {
        alert('파일 다운로드 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      alert('파일 다운로드 중 오류가 발생했습니다');
    }
  };

  const handleDeleteFile = async (fileType: 'document' | 'powerOfAttorney') => {
    const fileTypeNames = {
      document: '서류',
      powerOfAttorney: '위임장',
    };

    if (!confirm(`정말 ${fileTypeNames[fileType]} 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await (window as any).propertyOwner.deleteFile(
        propertyName,
        dong || '',
        ho || '',
        fileType
      );

      if (result.success) {
        alert(`${fileTypeNames[fileType]} 파일이 삭제되었습니다`);

        // existingFiles 상태 업데이트
        setExistingFiles({
          ...existingFiles,
          [fileType]: false,
        });
      } else {
        alert('파일 삭제 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      alert('파일 삭제 중 오류가 발생했습니다');
    }
  };

  // 소유자 타입 변경 핸들러
  const handleOwnerTypeChange = async (newOwnerType: '개인' | '법인' | '외국인' | '위임장') => {
    // 소유자 타입이 변경되었고 기존 파일이 있는 경우
    if (newOwnerType !== initialOwnerType) {
      const hasExistingFiles = existingFiles.document || existingFiles.powerOfAttorney;

      if (hasExistingFiles) {
        const confirmed = confirm(
          '소유자 타입을 변경하면 기존에 업로드된 모든 서류가 삭제됩니다.\n' +
          '계속하시겠습니까?'
        );

        if (!confirmed) {
          return; // 취소하면 변경하지 않음
        }

        // 모든 기존 파일 삭제
        try {
          setIsDeletingFiles(true);

          const filesToDelete: Array<'document' | 'powerOfAttorney'> = [];

          if (existingFiles.document) filesToDelete.push('document');
          if (existingFiles.powerOfAttorney) filesToDelete.push('powerOfAttorney');

          // 순차적으로 파일 삭제
          for (const fileType of filesToDelete) {
            await (window as any).propertyOwner.deleteFile(
              propertyName,
              dong || '',
              ho || '',
              fileType
            );
          }

          // existingFiles 상태 초기화
          setExistingFiles({
            document: false,
            powerOfAttorney: false,
          });

          // 소유자 타입 변경
          setFormData({
            ownerType: newOwnerType,
          });

          alert('기존 서류가 모두 삭제되었습니다. 새로운 서류를 업로드해주세요.');
        } catch (error) {
          console.error('파일 삭제 실패:', error);
          alert('파일 삭제 중 오류가 발생했습니다');
          return; // 삭제 실패 시 타입 변경하지 않음
        } finally {
          setIsDeletingFiles(false);
        }
      } else {
        // 기존 파일이 없으면 그냥 변경
        setFormData({
          ...formData,
          ownerType: newOwnerType,
        });
      }
    } else {
      // 같은 타입이면 그냥 변경
      setFormData({
        ...formData,
        ownerType: newOwnerType,
      });
    }
  };

  if (!isOpen) return null;

  const getDocumentLabel = () => {
    switch (formData.ownerType) {
      case '개인':
        return '서류 (분양계약서 또는 사업자등록증)';
      case '법인':
        return '법인 서류';
      case '외국인':
        return '외국인 서류';
      case '위임장':
        return '위임장 관련 서류';
      default:
        return '서류';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* 파일 삭제 중 로딩 오버레이 */}
        {isDeletingFiles && (
          <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">파일 삭제 중...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">소유자 정보 관리</h2>
            <p className="text-sm text-white/90 mt-1">
              {propertyName} {dong && `${dong}동`} {ho && `${ho}호`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded p-2 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 소유자 구분 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">매물소유자 구분 *</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['개인', '법인', '외국인', '위임장'] as const).map((type) => (
                <label
                  key={type}
                  className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition ${
                    formData.ownerType === type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="ownerType"
                    value={type}
                    checked={formData.ownerType === type}
                    onChange={(e) =>
                      handleOwnerTypeChange(e.target.value as typeof formData.ownerType)
                    }
                    className="cursor-pointer"
                  />
                  <span className="text-sm font-medium">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 파일 업로드 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">서류 첨부</h3>

            {/* 서류 파일 (필수) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getDocumentLabel()} *
              </label>
              {existingFiles.document && !files.document ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-700 font-medium flex-1">✓ 파일 업로드됨</span>
                  <Button
                    type="button"
                    onClick={() => handleDownloadFile('document')}
                    className="bg-blue-500 hover:bg-blue-600 h-8 px-3 py-0 text-xs"
                  >
                    <Download size={14} className="mr-1" />
                    다운로드
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDeleteFile('document')}
                    className="bg-red-500 hover:bg-red-600 h-8 px-3 py-0 text-xs"
                  >
                    <Trash2 size={14} className="mr-1" />
                    삭제
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleFileSelect('document')}
                    className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
                  >
                    <Upload size={16} className="mr-2" />
                    {files.document ? '파일 선택됨' : '파일 선택'}
                  </Button>
                  {files.document && (
                    <Button
                      type="button"
                      onClick={() => handleFileChange('document', null)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              )}
              {formData.ownerType === '개인' && (
                <p className="text-xs text-gray-500 mt-1">
                  분양계약서 또는 사업자등록증을 업로드해주세요
                </p>
              )}
            </div>

            {/* 위임장 (외국인/위임장 케이스) */}
            {shouldShowPowerOfAttorney() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위임장 {formData.ownerType === '위임장' && '*'}
                </label>
                {existingFiles.powerOfAttorney && !files.powerOfAttorney ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                    <span className="text-sm text-green-700 font-medium flex-1">✓ 파일 업로드됨</span>
                    <Button
                      type="button"
                      onClick={() => handleDownloadFile('powerOfAttorney')}
                      className="bg-blue-500 hover:bg-blue-600 h-8 px-3 py-0 text-xs"
                    >
                      <Download size={14} className="mr-1" />
                      다운로드
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDeleteFile('powerOfAttorney')}
                      className="bg-red-500 hover:bg-red-600 h-8 px-3 py-0 text-xs"
                    >
                      <Trash2 size={14} className="mr-1" />
                      삭제
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => handleFileSelect('powerOfAttorney')}
                      className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
                    >
                      <Upload size={16} className="mr-2" />
                      {files.powerOfAttorney ? '파일 선택됨' : '파일 선택'}
                    </Button>
                    {files.powerOfAttorney && (
                      <Button
                        type="button"
                        onClick={() => handleFileChange('powerOfAttorney', null)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                )}
                {formData.ownerType === '외국인' && (
                  <p className="text-xs text-gray-500 mt-1">선택 항목입니다</p>
                )}
              </div>
            )}
          </div>

          {/* 요구사항 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 필수 서류 안내</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              {formData.ownerType === '개인' && (
                <>
                  <li>• 서류: 분양계약서 또는 사업자등록증 (필수)</li>
                </>
              )}
              {formData.ownerType === '법인' && (
                <>
                  <li>• 서류: 법인 서류 (필수)</li>
                </>
              )}
              {formData.ownerType === '외국인' && (
                <>
                  <li>• 서류: 외국인 서류 (필수)</li>
                  <li>• 위임장: 선택</li>
                </>
              )}
              {formData.ownerType === '위임장' && (
                <>
                  <li>• 서류: 위임장 관련 서류 (필수)</li>
                  <li>• 위임장: 필수</li>
                </>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            {ownerInfo?.hasOwnerInfo ? (
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="bg-red-500 hover:bg-red-600"
              >
                <Trash2 size={16} className="mr-2" />
                {isDeleting ? '삭제 중...' : '삭제'}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="bg-gray-500 hover:bg-gray-600"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isDeleting}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Upload size={16} className="mr-2" />
                {isSaving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
