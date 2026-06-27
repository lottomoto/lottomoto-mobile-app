import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, HelpCircle, ChevronRight, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, Radius } from '@/constants/theme';
import Header from '../include/header';
import { getStoredUser, logout, changePin, type VendeurUser } from '@/lib/auth';
import { useRouter, useFocusEffect } from 'expo-router';

const MENU_COMPTE = [
    { label: 'Changer mon PIN', icon: Lock },
];

const MENU_SUPPORT = [
    { label: 'Aide & FAQ', icon: HelpCircle },
];

export default function Profile() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [user, setUser] = useState<VendeurUser | null>(null);
    const [showPin, setShowPin] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [saving, setSaving] = useState(false);

    useFocusEffect(useCallback(() => {
        getStoredUser().then(setUser);
    }, []));

    const initials = user ? `${user.firstname[0]}${user.lastname[0]}`.toUpperCase() : '??';

    const handleChangePin = async () => {
        if (currentPin.length < 4) return Toast.show({ type: 'error', text1: 'Erreur', text2: 'Entrez votre PIN actuel (4 chiffres)' });
        if (newPin.length < 4) return Toast.show({ type: 'error', text1: 'Erreur', text2: 'Le nouveau PIN doit avoir 4 chiffres' });
        if (newPin !== confirmPin) return Toast.show({ type: 'error', text1: 'Erreur', text2: 'Les PIN ne correspondent pas' });

        setSaving(true);
        try {
            await changePin(currentPin, newPin);
            Toast.show({ type: 'success', text1: 'Succès', text2: 'PIN modifié, reconnectez-vous' });
            setShowPin(false);
            setCurrentPin('');
            setNewPin('');
            setConfirmPin('');
            await logout();
            router.replace('/login');
        } catch (err: any) {
            const status = err.response?.status;
            const msg = status === 401 ? 'PIN actuel incorrect' : (err.response?.data?.message || 'Impossible de modifier le PIN');
            Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Avatar + Info */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>
                            {user ? `${user.firstname} ${user.lastname}` : '...'}
                        </Text>
                        {user?.email && <Text style={styles.profilePhone}>{user.email}</Text>}
                        <View style={styles.profileMeta}>
                            <View style={styles.statusBadge}>
                                <Text style={styles.statusText}>VENDEUR</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Compte */}
                <Text style={styles.sectionTitle}>COMPTE</Text>
                <View style={styles.menuCard}>
                    {MENU_COMPTE.map((item, i) => (
                        <Pressable
                            key={item.label}
                            style={[styles.menuItem, i > 0 && styles.menuItemBorder]}
                            onPress={item.label === 'Changer mon PIN' ? () => setShowPin(true) : undefined}
                        >
                            <View style={styles.menuItemLeft}>
                                <item.icon size={18} color={Colors.gold} />
                                <Text style={styles.menuItemLabel}>{item.label}</Text>
                            </View>
                            <ChevronRight size={16} color={Colors.gray} />
                        </Pressable>
                    ))}
                </View>

                {/* Support */}
                <Text style={styles.sectionTitle}>SUPPORT</Text>
                <View style={styles.menuCard}>
                    {MENU_SUPPORT.map((item, i) => (
                        <Pressable key={item.label} style={[styles.menuItem, i > 0 && styles.menuItemBorder]}>
                            <View style={styles.menuItemLeft}>
                                <item.icon size={18} color={Colors.gold} />
                                <Text style={styles.menuItemLabel}>{item.label}</Text>
                            </View>
                            <ChevronRight size={16} color={Colors.gray} />
                        </Pressable>
                    ))}
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Bottom sheet PIN */}
            <Modal
                visible={showPin}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPin(false)}
            >
                <KeyboardAvoidingView style={styles.pinOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowPin(false)} />
                    <View style={styles.pinSheet}>
                        <View style={styles.pinHeader}>
                            <Text style={styles.pinTitle}>Changer PIN</Text>
                            <Pressable onPress={() => setShowPin(false)}>
                                <X size={20} color={Colors.gray} />
                            </Pressable>
                        </View>

                        <Text style={styles.pinLabel}>PIN actuel</Text>
                        <TextInput
                            style={styles.pinInput}
                            value={currentPin}
                            onChangeText={(v) => setCurrentPin(v.replace(/\D/g, '').slice(0, 4))}
                            placeholder="····"
                            placeholderTextColor={Colors.gray}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                        />

                        <Text style={styles.pinLabel}>Nouveau PIN</Text>
                        <TextInput
                            style={styles.pinInput}
                            value={newPin}
                            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                            placeholder="····"
                            placeholderTextColor={Colors.gray}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                        />

                        <Text style={styles.pinLabel}>Confirmer PIN</Text>
                        <TextInput
                            style={styles.pinInput}
                            value={confirmPin}
                            onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
                            placeholder="····"
                            placeholderTextColor={Colors.gray}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                        />

                        <Pressable
                            style={[styles.pinButton, saving && { opacity: 0.5 }]}
                            onPress={handleChangePin}
                            disabled={saving}
                        >
                            <Text style={styles.pinButtonText}>
                                {saving ? 'Enregistrement...' : 'Changer PIN'}
                            </Text>
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    scroll: {
        padding: Spacing.xl,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    avatarLarge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.navy,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    profilePhone: {
        fontSize: 13,
        color: Colors.gray,
        marginTop: 2,
    },
    profileMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: 6,
    },
    statusBadge: {
        backgroundColor: Colors.green,
        borderRadius: Radius.full,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.white,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.gray,
        letterSpacing: 1,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    menuCard: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    menuItemBorder: {
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    menuItemLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.offWhite,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.red + '40',
        borderRadius: Radius.md,
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.red,
    },
    pinOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    pinSheet: {
        backgroundColor: Colors.navyLight,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        padding: Spacing.xl,
        paddingBottom: 40,
    },
    pinHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    pinTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    pinLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray,
        marginBottom: Spacing.xs,
        marginTop: Spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pinInput: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: 20,
        fontWeight: '700',
        color: Colors.offWhite,
        letterSpacing: 8,
        textAlign: 'center',
    },
    pinButton: {
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    pinButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.navy,
    },
});
