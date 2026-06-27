import { useState, useRef, useCallback, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ActivityIndicator } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Colors, Spacing, Radius } from '@/constants/theme';
import api from '@/lib/api';

interface TirageData {
    id: string;
    nom: string;
    fermeture: string;
}

interface BorletteData {
    id: string;
    nom: string;
    code: string;
    tirages: TirageData[];
}

export default function Tirage() {
    const [borlettes, setBorlettes] = useState<BorletteData[]>([]);
    const [selected, setSelected] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const buttonRef = useRef<View>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get<BorletteData[]>('/borlettes');
                const active = data.filter((b) => b.tirages.length > 0);
                setBorlettes(active);
                if (active.length > 0) setSelected(active[0].id);
            } catch { /* */ } finally {
                setLoading(false);
            }
        })();
    }, []);

    const current = borlettes.find(b => b.id === selected);
    const tirages = current?.tirages || [];

    const handleOpen = useCallback(() => {
        if (buttonRef.current) {
            buttonRef.current.measureInWindow((x, y, width, height) => {
                setButtonLayout({ x, y, width, height });
                setOpen(true);
            });
        }
    }, []);

    if (loading) {
        return (
            <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.gold} />
            </View>
        );
    }

    if (borlettes.length === 0) return null;

    return (
        <View>
            {/* Select borlette */}
            <View style={styles.selectWrapper}>
                <Pressable ref={buttonRef} style={styles.selectButton} onPress={handleOpen}>
                    <Text style={styles.selectText}>{current?.nom || 'Sélectionner'}</Text>
                    <ChevronDown size={16} color={Colors.offWhite} />
                </Pressable>

                <Modal
                    visible={open}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setOpen(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
                        <View
                            style={[
                                styles.dropdown,
                                {
                                    top: buttonLayout.y + buttonLayout.height + 4,
                                    left: buttonLayout.x,
                                    width: buttonLayout.width,
                                },
                            ]}
                        >
                            {borlettes.map((b) => (
                                <Pressable
                                    key={b.id}
                                    style={[
                                        styles.dropdownItem,
                                        b.id === selected && styles.dropdownItemActive,
                                    ]}
                                    onPress={() => {
                                        setSelected(b.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.dropdownText,
                                        b.id === selected && styles.dropdownTextActive,
                                    ]}>
                                        {b.nom}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </Pressable>
                </Modal>
            </View>

            {/* Tirages cards */}
            <View style={styles.tiragesRow}>
                {tirages.map((t) => {
                    const now = new Date();
                    const [h, m] = t.fermeture.split(':').map(Number);
                    const fermetureDate = new Date();
                    fermetureDate.setHours(h, m, 0);
                    const isClosed = now > fermetureDate;

                    return (
                        <View
                            key={t.id}
                            style={[
                                styles.tirageCard,
                                isClosed
                                    ? { backgroundColor: Colors.navyMedium }
                                    : { backgroundColor: Colors.navyLight, borderColor: Colors.navyMedium, borderWidth: 1 },
                            ]}
                        >
                            <Text style={[styles.tirageCheck, { color: isClosed ? Colors.greenLight : Colors.gray }]}>
                                {isClosed ? '✓ ' : '○ '}
                                <Text style={styles.tirageLabel}>{t.nom}</Text>
                            </Text>
                            <Text style={[styles.tirageTime, { color: isClosed ? Colors.offWhite : Colors.gray }]}>
                                {isClosed ? 'Fermé' : `Ferme à ${t.fermeture}`}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    selectWrapper: {
        marginBottom: Spacing.md,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    selectText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    modalOverlay: {
        flex: 1,
    },
    dropdown: {
        position: 'absolute',
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.navyMedium,
        overflow: 'hidden',
    },
    dropdownItem: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    dropdownItemActive: {
        backgroundColor: Colors.gold + '20',
    },
    dropdownText: {
        fontSize: 14,
        color: Colors.gray,
    },
    dropdownTextActive: {
        color: Colors.gold,
        fontWeight: '700',
    },
    tiragesRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    tirageCard: {
        flex: 1,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    tirageCheck: {
        fontSize: 11,
        fontWeight: '600',
    },
    tirageLabel: {
        fontSize: 11,
        color: Colors.offWhite,
    },
    tirageTime: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
});
