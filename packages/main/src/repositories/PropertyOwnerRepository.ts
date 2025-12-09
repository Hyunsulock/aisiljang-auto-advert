import { supabase } from '../lib/supabase.js';
import type {
  Property,
  PropertyInsert,
  PropertyVerificationInfo,
  PropertyVerificationInfoInsert,
  PropertyVerificationInfoUpdate,
  PropertyWithVerification,
} from '../types/supabase.js';

export interface PropertyKey {
  name: string;
  dong?: string;
  ho?: string;
}

/**
 * 매물 소유자 정보 Repository
 */
export class PropertyOwnerRepository {
  /**
   * 여러 매물의 소유자 정보 조회 (RPC 사용)
   */
  async getPropertiesByKeys(keys: PropertyKey[]): Promise<PropertyWithVerification[]> {
    const { data, error } = await supabase.rpc('get_properties_by_keys', {
      property_keys: keys.map(k => ({
        name: k.name,
        dong: k.dong || '',
        ho: k.ho || '',
      })),
    });

    if (error) {
      console.error('❌ RPC 호출 실패:', error);
      throw new Error(`Failed to get properties: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 단일 매물의 소유자 정보 조회
   */
  async getPropertyByKey(key: PropertyKey): Promise<PropertyWithVerification | null> {
    const results = await this.getPropertiesByKeys([key]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 매물 기본 정보 생성 (upsert)
   */
  async upsertProperty(property: PropertyInsert): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .upsert(property, {
        onConflict: 'agency_id,property_name,dong,ho',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Property upsert 실패:', error);
      throw new Error(`Failed to upsert property: ${error.message}`);
    }

    return data;
  }

  /**
   * 소유자/검증 정보 생성 또는 업데이트
   */
  async upsertVerificationInfo(
    propertyId: string,
    verificationInfo: Omit<PropertyVerificationInfoInsert, 'property_id'>
  ): Promise<PropertyVerificationInfo> {
    // 기존 데이터 확인
    const { data: existing } = await supabase
      .from('property_verification_info')
      .select('id')
      .eq('property_id', propertyId)
      .single();

    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('property_verification_info')
        .update(verificationInfo as PropertyVerificationInfoUpdate)
        .eq('property_id', propertyId)
        .select()
        .single();

      if (error) {
        console.error('❌ Verification info update 실패:', error);
        throw new Error(`Failed to update verification info: ${error.message}`);
      }

      return data;
    } else {
      // 생성 - agency_id가 필수임
      if (!verificationInfo.agency_id) {
        throw new Error('agency_id is required for inserting verification info');
      }

      const insertData = {
        property_id: propertyId,
        agency_id: verificationInfo.agency_id,
        owner_type: verificationInfo.owner_type,
        document_file_path: verificationInfo.document_file_path,
        power_of_attorney_file_path: verificationInfo.power_of_attorney_file_path,
      };

      console.log('📝 Verification info insert data:', insertData);

      const { data, error } = await supabase
        .from('property_verification_info')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ Verification info insert 실패:', error);
        console.error('Insert data was:', insertData);
        throw new Error(`Failed to insert verification info: ${error.message}`);
      }

      return data;
    }
  }

  /**
   * 매물과 소유자 정보 한번에 저장
   */
  async savePropertyWithVerification(
    propertyKey: PropertyKey,
    verificationInfo: Omit<PropertyVerificationInfoInsert, 'property_id'>
  ): Promise<PropertyWithVerification> {
    // 1. Property 생성/업데이트
    const property = await this.upsertProperty({
      agency_id: verificationInfo.agency_id,
      property_name: propertyKey.name,
      dong: propertyKey.dong || null,
      ho: propertyKey.ho || null,
    });

    // 2. Verification info 생성/업데이트
    await this.upsertVerificationInfo(property.id, verificationInfo);

    // 3. 전체 정보 조회
    const result = await this.getPropertyByKey(propertyKey);
    if (!result) {
      throw new Error('Failed to retrieve saved property');
    }

    return result;
  }

  /**
   * 매물 삭제
   */
  async deleteProperty(propertyId: string): Promise<void> {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) {
      console.error('❌ Property delete 실패:', error);
      throw new Error(`Failed to delete property: ${error.message}`);
    }
  }

  /**
   * 검증 정보 삭제
   */
  async deleteVerificationInfo(propertyId: string): Promise<void> {
    const { error } = await supabase
      .from('property_verification_info')
      .delete()
      .eq('property_id', propertyId);

    if (error) {
      console.error('❌ Verification info delete 실패:', error);
      throw new Error(`Failed to delete verification info: ${error.message}`);
    }
  }
}