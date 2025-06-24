import React, {useState, useEffect, useMemo} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
  I18nManager,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import Modal from 'react-native-modal';
import firestore from '@react-native-firebase/firestore';
import {Dropdown} from 'react-native-element-dropdown';
import Slider from '@react-native-community/slider'; // <-- 1. IMPORT SLIDER

I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

interface Equipment {
  id: string;
  name: string;
  brand: string;
  count: number;
  boughtPrice: number;
  soldPrice: number;
}

// --- 2. UPDATE FILTEROPTIONS INTERFACE ---
interface FilterOptions {
  brand: string | null;
  sort: string | null;
  maxCount: number | null;
}

const App = () => {
  const [loading, setLoading] = useState(true);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // --- 3. UPDATE FILTERS INITIAL STATE ---
  const [filters, setFilters] = useState<FilterOptions>({
    brand: null,
    sort: null,
    maxCount: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newItem, setNewItem] = useState({
    id: '',
    name: '',
    brand: '',
    count: '',
    boughtPrice: '',
    soldPrice: '',
  });

  useEffect(() => {
    const subscriber = firestore()
      .collection('equipment')
      .onSnapshot(
        querySnapshot => {
          const equipmentList: Equipment[] = [];
          querySnapshot.forEach(documentSnapshot => {
            equipmentList.push({
              ...(documentSnapshot.data() as Equipment),
              id: documentSnapshot.id,
            });
          });
          setAllEquipment(equipmentList);
          setLoading(false);
        },
        error => {
          console.error('Firestore Error: ', error);
          setLoading(false);
        },
      );
    return () => subscriber();
  }, []);

  // --- 4. UPDATE FILTERING LOGIC ---
  const {filteredAndGroupedData, brandOptions, maxCountValue} = useMemo(() => {
    const uniqueBrands = [
      ...new Set(allEquipment.map(item => item.brand)),
    ].sort();
    const brandDropdownOptions = uniqueBrands.map(brand => ({
      label: brand,
      value: brand,
    }));

    const highestCount = allEquipment.length > 0 ? Math.max(...allEquipment.map(item => item.count)) : 0;
    
    // Use highestCount as the default if filters.maxCount is not set
    const currentMaxCount = filters.maxCount ?? highestCount;

    let filtered = allEquipment
      .filter(
        item =>
          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .filter(item => (filters.brand ? item.brand === filters.brand : true))
      .filter(item => item.count <= currentMaxCount); // <-- New filter for count

    if (filters.sort) {
      switch (filters.sort) {
        case 'sold_asc':
          filtered.sort((a, b) => a.soldPrice - b.soldPrice);
          break;
        case 'sold_desc':
          filtered.sort((a, b) => b.soldPrice - a.soldPrice);
          break;
        case 'count_asc':
          filtered.sort((a, b) => a.count - b.count);
          break;
        case 'count_desc':
          filtered.sort((a, b) => b.count - a.count);
          break;
      }
    }

    const groups = filtered.reduce((acc, item) => {
      (acc[item.brand] = acc[item.brand] || []).push(item);
      return acc;
    }, {} as {[key: string]: Equipment[]});

    const finalData = Object.keys(groups).map(key => ({
      brand: key,
      data: groups[key],
    }));

    return {
      filteredAndGroupedData: finalData,
      brandOptions: brandDropdownOptions,
      maxCountValue: highestCount,
    };
  }, [allEquipment, searchQuery, filters]);

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    try {
      await firestore().collection('equipment').doc(selectedItem.id).update({
        ...selectedItem,
        count: Number(selectedItem.count),
        boughtPrice: Number(selectedItem.boughtPrice),
        soldPrice: Number(selectedItem.soldPrice),
      });
      Alert.alert('نجاح', 'تم تحديث القطعة بنجاح.');
      setSelectedItem(null);
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث القطعة.');
    }
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف "${selectedItem.name}"؟`,
      [
        {text: 'إلغاء', style: 'cancel'},
        {
          text: 'نعم, إحذف',
          style: 'destructive',
          onPress: async () => {
            await firestore()
              .collection('equipment')
              .doc(selectedItem.id)
              .delete();
            setSelectedItem(null);
          },
        },
      ],
    );
  };

  const handleAddItem = async () => {
    if (!newItem.id.trim() || !newItem.name.trim() || !newItem.brand.trim()) {
      Alert.alert('خطأ', 'الرجاء ملء حقول الرقم، الاسم، والماركة.');
      return;
    }
    try {
      await firestore().collection('equipment').doc(newItem.id.trim()).set({
        name: newItem.name.trim(),
        brand: newItem.brand.trim(),
        count: Number(newItem.count) || 0,
        boughtPrice: Number(newItem.boughtPrice) || 0,
        soldPrice: Number(newItem.soldPrice) || 0,
      });
      setAddModalVisible(false);
      setNewItem({
        id: '',
        name: '',
        brand: '',
        count: '',
        boughtPrice: '',
        soldPrice: '',
      });
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ. قد يكون رقم القطعة موجود مسبقاً.');
    }
  };

  // --- 5. UPDATE CLEARFILTERS FUNCTION ---
  const clearFilters = () => {
    setFilters({brand: null, sort: null, maxCount: null});
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const renderItemCard = ({item}: {item: Equipment}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedItem(item)}>
      <Text style={styles.itemName} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.itemCode}>{item.id}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.itemCount}>الكمية: {item.count}</Text>
        <Text style={styles.itemPrice}>${item.soldPrice}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderGroup = ({item}: {item: {brand: string; data: Equipment[]}}) => (
    <View style={styles.groupContainer}>
      <Text style={styles.brandTitle}>{item.brand}</Text>
      <FlatList
        data={item.data}
        renderItem={renderItemCard}
        keyExtractor={subItem => subItem.id}
        numColumns={2}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      <View style={{flex: 1}}>
        <View style={styles.header}>
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث بالرقم أو اسم القطعة..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}>
            <Text style={styles.filterButtonText}>
              {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
            </Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterContainer}>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              data={brandOptions}
              labelField="label"
              valueField="value"
              placeholder="تصفية حسب الماركة"
              value={filters.brand}
              onChange={item => setFilters({...filters, brand: item.value})}
            />
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              data={[
                {label: 'الكمية (من الأعلى للأقل)', value: 'count_desc'},
                {label: 'الكمية (من الأقل للأعلى)', value: 'count_asc'},
                {label: 'سعر البيع (من الأعلى للأقل)', value: 'sold_desc'},
                {label: 'سعر البيع (من الأقل للأعلى)', value: 'sold_asc'},
              ]}
              labelField="label"
              valueField="value"
              placeholder="ترتيب حسب"
              value={filters.sort}
              onChange={item => setFilters({...filters, sort: item.value})}
            />
            {/* --- 6. ADD THE SLIDER UI --- */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                الكمية القصوى: {filters.maxCount ?? Math.round(maxCountValue)}
              </Text>
              <Slider
                style={{width: '100%', height: 40}}
                minimumValue={0}
                maximumValue={maxCountValue > 0 ? maxCountValue : 1} // Ensure max is not 0
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#D1D1D6"
                thumbTintColor="#007AFF"
                value={filters.maxCount ?? maxCountValue}
                onValueChange={value =>
                  setFilters({...filters, maxCount: Math.round(value)})
                }
              />
            </View>

            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={clearFilters}>
              <Text style={styles.clearFilterButtonText}>مسح كل الفلاتر</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={filteredAndGroupedData}
          renderItem={renderGroup}
          keyExtractor={group => group.brand}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>لا توجد نتائج</Text>
          }
        />
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal
        isVisible={isAddModalVisible}
        onBackdropPress={() => setAddModalVisible(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>إضافة قطعة جديدة</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>رقم القطعة (Spare Code)</Text>
            <TextInput
              style={styles.input}
              value={newItem.id}
              onChangeText={t => setNewItem({...newItem, id: t})}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>اسم القطعة</Text>
            <TextInput
              style={styles.input}
              value={newItem.name}
              onChangeText={t => setNewItem({...newItem, name: t})}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>الماركة</Text>
            <TextInput
              style={styles.input}
              value={newItem.brand}
              onChangeText={t => setNewItem({...newItem, brand: t})}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>الكمية</Text>
            <TextInput
              style={styles.input}
              value={newItem.count}
              onChangeText={t => setNewItem({...newItem, count: t})}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>سعر الشراء</Text>
            <TextInput
              style={styles.input}
              value={newItem.boughtPrice}
              onChangeText={t => setNewItem({...newItem, boughtPrice: t})}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>سعر البيع</Text>
            <TextInput
              style={styles.input}
              value={newItem.soldPrice}
              onChangeText={t => setNewItem({...newItem, soldPrice: t})}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleAddItem}>
            <Text style={styles.buttonText}>إضافة للمخزن</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {selectedItem && (
        <Modal
          isVisible={true}
          onBackdropPress={() => setSelectedItem(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تعديل بيانات القطعة</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>رقم القطعة (Spare Code)</Text>
              <TextInput
                style={[styles.input, styles.disabledInput]}
                value={selectedItem.id}
                editable={false}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>اسم القطعة</Text>
              <TextInput
                style={styles.input}
                value={selectedItem.name}
                onChangeText={t =>
                  setSelectedItem({...selectedItem, name: t})
                }
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>الماركة</Text>
              <TextInput
                style={styles.input}
                value={selectedItem.brand}
                onChangeText={t =>
                  setSelectedItem({...selectedItem, brand: t})
                }
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>الكمية</Text>
              <TextInput
                style={styles.input}
                value={String(selectedItem.count)}
                onChangeText={t =>
                  setSelectedItem({...selectedItem, count: Number(t) || 0})
                }
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>سعر الشراء</Text>
              <TextInput
                style={styles.input}
                value={String(selectedItem.boughtPrice)}
                onChangeText={t =>
                  setSelectedItem({
                    ...selectedItem,
                    boughtPrice: Number(t) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>سعر البيع</Text>
              <TextInput
                style={styles.input}
                value={String(selectedItem.soldPrice)}
                onChangeText={t =>
                  setSelectedItem({
                    ...selectedItem,
                    soldPrice: Number(t) || 0,
                  })
                }
                keyboardType="numeric"
              />
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={handleUpdateItem}>
              <Text style={styles.buttonText}>حفظ التعديلات</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeleteItem}>
              <Text style={styles.buttonText}>حذف القطعة</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

// --- 7. ADD STYLES FOR SLIDER ---
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9F9F9'},
  loadingContainer: {justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 10, fontSize: 18, color: '#4F4F4F'},
  header: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginTop: StatusBar.currentHeight || 0,
  },
  searchInput: {
    height: 45,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  filterButton: {paddingVertical: 10, alignItems: 'center'},
  filterButtonText: {color: '#007AFF', fontSize: 16, fontWeight: '500'},
  filterContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  dropdown: {
    height: 50,
    borderColor: 'gray',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  placeholderStyle: {fontSize: 16, textAlign: 'right'},
  selectedTextStyle: {fontSize: 16, textAlign: 'right'},
  sliderContainer: {
    marginTop: 15,
    paddingHorizontal: 5,
  },
  sliderLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'right',
    marginBottom: 5,
  },
  clearFilterButton: {
    marginTop: 15,
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFilterButtonText: {color: 'white', fontWeight: 'bold'},
  listContent: {paddingHorizontal: 5, paddingTop: 10},
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 18,
    color: '#8E8E93',
  },
  groupContainer: {marginBottom: 15},
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 10,
    textAlign: 'right',
    paddingHorizontal: 5,
  },
  card: {
    flex: 1,
    margin: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  itemName: {
    padding: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'right',
  },
  itemCode: {
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'center',
  },
  itemCount: {fontSize: 14, color: '#34C759', fontWeight: 'bold'},
  itemPrice: {fontSize: 14, color: '#007AFF', fontWeight: 'bold'},
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    elevation: 8,
  },
  fabIcon: {fontSize: 30, color: 'white'},
  modalContent: {backgroundColor: 'white', padding: 22, borderRadius: 14},
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F4F4F',
    textAlign: 'right',
    marginRight: 5,
  },
  input: {
    height: 50,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 5,
    paddingHorizontal: 15,
    textAlign: 'right',
    fontSize: 16,
  },
  disabledInput: {backgroundColor: '#F2F2F2', color: '#828282'},
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {color: 'white', fontSize: 16, fontWeight: 'bold'},
  deleteButton: {backgroundColor: '#FF3B30', marginTop: 10},
});

export default App;