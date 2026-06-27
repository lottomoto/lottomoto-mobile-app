import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { loginWithPin, getSavedUsername, isAuthenticated, getLastTab, getDraftFiche } from '@/lib/auth';

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [savedUser, setSavedUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const pinRef = useRef<TextInput>(null);

    useEffect(() => {
        (async () => {
            const authed = await isAuthenticated();
            if (authed) {
                router.replace('/(tabs)');
                return;
            }
            const saved = await getSavedUsername();
            if (saved) {
                setSavedUser(saved);
                setUsername(saved);
            }
            setChecking(false);
        })();
    }, []);

    const isFirstLogin = !savedUser;
    const isValid = username.length > 0 && pin.length === 4;

    const handleLogin = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            await loginWithPin(username, pin);
            const lastTab = await getLastTab();
            const draft = await getDraftFiche();
            if (lastTab === 'vendre' && draft?.lignes?.length > 0) {
                router.replace('/(tabs)/vendre' as any);
            } else if (lastTab && lastTab !== 'index' && lastTab !== 'vendre') {
                router.replace(`/(tabs)/${lastTab}` as any);
            } else {
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            const raw = err?.response?.data?.message;
            const msg = Array.isArray(raw) ? raw[0] : (raw || 'Nom d\'utilisateur ou PIN incorrect');
            Toast.show({ type: 'error', text1: 'Connexion refusée', text2: String(msg) });
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handleSwitchUser = () => {
        setSavedUser(null);
        setUsername('');
        setPin('');
    };

    if (checking) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.gold} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { paddingTop: insets.top + 40 }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                {/* Logo */}
                <View style={styles.logoSection}>
                    <View style={styles.logoBox}>
                        <Trophy size={32} color={Colors.navy} />
                    </View>
                    <Text style={styles.logoTitle}>La Différence</Text>
                    <Text style={styles.logoSub}>LOTTO / MOTO</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {isFirstLogin ? (
                        <>
                            <Text style={styles.formTitle}>Connexion</Text>
                            <Text style={styles.formSubtitle}>Entrez vos informations</Text>

                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Nom d&apos;utilisateur</Text>
                                <TextInput
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="Ex: marie.joseph"
                                    placeholderTextColor={Colors.gray}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => pinRef.current?.focus()}
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.welcomeBack}>
                                <View style={styles.welcomeAvatar}>
                                    <Text style={styles.welcomeAvatarText}>
                                        {savedUser?.slice(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.formTitle}>Bon retour</Text>
                                <Text style={styles.welcomeUsername}>@{savedUser}</Text>
                            </View>
                        </>
                    )}

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>
                            {isFirstLogin ? 'PIN (4 chiffres)' : 'Entrez votre PIN'}
                        </Text>
                        <TextInput
                            ref={pinRef}
                            style={styles.pinInput}
                            value={pin}
                            onChangeText={(val) => {
                                const cleaned = val.replace(/\D/g, '').slice(0, 4);
                                setPin(cleaned);
                                if (cleaned.length === 4 && !isFirstLogin) {
                                    setTimeout(() => {
                                        setPin(cleaned);
                                        handleLoginAuto(cleaned);
                                    }, 100);
                                }
                            }}
                            placeholder="····"
                            placeholderTextColor={Colors.gray}
                            keyboardType="number-pad"
                            maxLength={4}
                            secureTextEntry
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                            autoFocus={!isFirstLogin}
                        />
                        <View style={styles.pinDots}>
                            {[0, 1, 2, 3].map((i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.pinDot,
                                        pin.length > i && styles.pinDotFilled,
                                    ]}
                                />
                            ))}
                        </View>
                    </View>

                    {isFirstLogin && (
                        <Pressable
                            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={!isValid || loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={Colors.navy} />
                            ) : (
                                <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
                                    Se connecter
                                </Text>
                            )}
                        </Pressable>
                    )}

                    {!isFirstLogin && loading && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={Colors.gold} />
                            <Text style={styles.loadingText}>Connexion...</Text>
                        </View>
                    )}

                    {/* {!isFirstLogin && (
                        <Pressable onPress={handleSwitchUser} style={styles.switchUser}>
                            <Text style={styles.switchUserText}>Changer d&apos;utilisateur</Text>
                        </Pressable>
                    )} */}
                </View>

                <Text style={styles.footer}>Accès sécurisé • La Différence © 2026</Text>
            </View>
        </KeyboardAvoidingView>
    );

    async function handleLoginAuto(pinValue: string) {
        if (!username || pinValue.length !== 4) return;
        setLoading(true);
        try {
            await loginWithPin(username, pinValue);
            const lastTab = await getLastTab();
            const draft = await getDraftFiche();
            if (lastTab === 'vendre' && draft?.lignes?.length > 0) {
                router.replace('/(tabs)/vendre' as any);
            } else if (lastTab && lastTab !== 'index' && lastTab !== 'vendre') {
                router.replace(`/(tabs)/${lastTab}` as any);
            } else {
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            const raw = err?.response?.data?.message;
            const msg = Array.isArray(raw) ? raw[0] : (raw || 'PIN incorrect');
            Toast.show({ type: 'error', text1: 'Connexion refusée', text2: String(msg) });
            setPin('');
        } finally {
            setLoading(false);
        }
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing['2xl'],
        justifyContent: 'center',
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoBox: {
        width: 64,
        height: 64,
        borderRadius: Radius.lg,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    logoTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    logoSub: {
        fontSize: 10,
        letterSpacing: 4,
        color: Colors.gold,
        marginTop: 4,
    },
    form: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.xl,
        padding: Spacing.xl,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.offWhite,
        marginBottom: 4,
    },
    formSubtitle: {
        fontSize: 13,
        color: Colors.gray,
        marginBottom: Spacing.xl,
    },
    welcomeBack: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    welcomeAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    welcomeAvatarText: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.navy,
    },
    welcomeUsername: {
        fontSize: 14,
        color: Colors.gold,
        marginTop: 4,
    },
    fieldGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.gray,
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: 15,
        color: Colors.offWhite,
    },
    pinInput: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: 24,
        fontWeight: '700',
        color: Colors.offWhite,
        textAlign: 'center',
        letterSpacing: 12,
    },
    pinDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: Spacing.md,
    },
    pinDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.navyMedium,
        borderWidth: 1.5,
        borderColor: Colors.gray,
    },
    pinDotFilled: {
        backgroundColor: Colors.gold,
        borderColor: Colors.gold,
    },
    button: {
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    buttonDisabled: {
        backgroundColor: Colors.navyMedium,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.navy,
    },
    buttonTextDisabled: {
        color: Colors.gray,
    },
    loadingRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: Spacing.lg,
    },
    loadingText: {
        fontSize: 13,
        color: Colors.gold,
    },
    switchUser: {
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    switchUserText: {
        fontSize: 13,
        color: Colors.gray,
        textDecorationLine: 'underline',
    },
    footer: {
        textAlign: 'center',
        fontSize: 11,
        color: Colors.gray,
        marginTop: 32,
    },
});
