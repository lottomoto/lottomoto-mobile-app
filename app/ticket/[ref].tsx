import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import api from '@/lib/api';
import { saveDraftFiche } from '@/lib/auth';

interface TicketData {
    id: string;
    ref: string;
    borlette: string;
    tirage: string;
    date: string;
    total: number;
    status: string;
    lignes: { id: string; numero: string; type: string; option: string; prix: number }[];
    createdAt: string;
}

export default function TicketDetailScreen() {
    const { ref } = useLocalSearchParams<{ ref: string }>();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!ref) return;
        (async () => {
            try {
                const { data } = await api.get<TicketData>(`/tickets/${ref}`);
                setTicket(data);
            } catch {
                setError('Fiche non trouvée');
            } finally {
                setLoading(false);
            }
        })();
    }, [ref]);

    const statusLabel = ticket?.status === 'gagne' ? 'GAGNÉ' : ticket?.status === 'paye' ? 'PAYÉ' : ticket?.status === 'perdu' ? 'PERDU' : 'EN ATTENTE';
    const statusColor = ticket?.status === 'gagne' || ticket?.status === 'paye' ? Colors.green : ticket?.status === 'perdu' ? Colors.red : Colors.gold;

    const handleReplay = async () => {
        if (!ticket) return;
        const lignes = ticket.lignes.map((l, i) => ({
            id: i + 1,
            type: l.type,
            numero: l.numero,
            option: l.option,
            prix: String(l.prix),
        }));
        await saveDraftFiche({ borlette: '', tirage: '', lignes });
        router.replace('/(tabs)/vendre' as any);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <ArrowLeft size={24} color={Colors.offWhite} />
                </Pressable>
                <Text style={styles.headerTitle}>Fiche {ref}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.gold} />
                    </View>
                ) : error ? (
                    <View style={styles.center}>
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable style={styles.backBtn} onPress={() => router.back()}>
                            <Text style={styles.backBtnText}>Retour</Text>
                        </Pressable>
                    </View>
                ) : ticket ? (
                    <View style={styles.card}>
                        <View style={[styles.statusBanner, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Réf.</Text>
                            <Text style={styles.infoValue}>{ticket.ref}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Borlette</Text>
                            <Text style={styles.infoValue}>{ticket.borlette}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Tirage</Text>
                            <Text style={styles.infoValue}>{ticket.tirage}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date</Text>
                            <Text style={styles.infoValue}>
                                {new Date(ticket.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.infoLabel}>Total</Text>
                            <Text style={[styles.infoValue, { color: Colors.gold, fontSize: 18, fontWeight: '800' }]}>
                                {Number(ticket.total).toLocaleString()} HTG
                            </Text>
                        </View>

                        <View style={styles.divider} />

                        <Text style={styles.sectionTitle}>Lignes ({ticket.lignes.length})</Text>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCol, { flex: 1 }]}>Numéro</Text>
                            <Text style={[styles.tableCol, { width: 35 }]}>Type</Text>
                            <Text style={[styles.tableCol, { width: 40 }]}>Opt</Text>
                            <Text style={[styles.tableCol, { width: 50, textAlign: 'right' }]}>Prix</Text>
                        </View>
                        {ticket.lignes.map((l) => (
                            <View key={l.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 1, fontWeight: '700', letterSpacing: 2 }]}>{l.numero}</Text>
                                <Text style={[styles.tableCell, { width: 35 }]}>{l.type === 'jackpot' ? 'JP' : l.type === 'lotto5' ? 'L5' : 'L4'}</Text>
                                <Text style={[styles.tableCell, { width: 40 }]}>{l.type === 'jackpot' ? '—' : l.option === 'opt1' ? 'Op1' : 'Op2'}</Text>
                                <Text style={[styles.tableCell, { width: 50, textAlign: 'right' }]}>{Number(l.prix).toLocaleString()}</Text>
                            </View>
                        ))}

                        <View style={styles.divider} />

                        <Pressable style={styles.replayBtn} onPress={handleReplay}>
                            <RefreshCw size={16} color={Colors.navy} />
                            <Text style={styles.replayBtnText}>Rejouer cette fiche</Text>
                        </Pressable>
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    scroll: {
        padding: Spacing.xl,
    },
    center: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    errorText: {
        fontSize: 15,
        color: Colors.red,
        marginBottom: Spacing.lg,
    },
    backBtn: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    backBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    card: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.xl,
    },
    statusBanner: {
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 2,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.navyMedium,
    },
    infoLabel: {
        fontSize: 13,
        color: Colors.gray,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.navyMedium,
        marginVertical: Spacing.lg,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
    },
    tableHeader: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    tableCol: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 4,
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    tableCell: {
        fontSize: 13,
        color: Colors.offWhite,
    },
    replayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
    },
    replayBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.navy,
    },
});
