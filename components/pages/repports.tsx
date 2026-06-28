import { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ScanLine, X, RefreshCw, Share2 } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { saveDraftFiche } from '@/lib/auth';
import Toast from 'react-native-toast-message';
import { Colors, Spacing, Radius } from '@/constants/theme';
import Header from '../include/header';
import api from '@/lib/api';

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

const formatDate = (iso: string) => {
    try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
};

export default function ReportsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedFiche, setExpandedFiche] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scannedTicket, setScannedTicket] = useState<TicketData | null>(null);
    const [scanning, setScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [ficheSettings, setFicheSettings] = useState<Record<string, string>>({});
    const [chartData, setChartData] = useState<{ label: string; total: number; fiches: number }[]>([]);

    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get<TicketData[]>('/tickets/me');
            setTickets(data);
        } catch { /* */ } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchTickets();
        api.get<Record<string, string>>('/settings').then(({ data }) => setFicheSettings(data)).catch(() => { });
        api.get<any>('/tickets/me/stats').then(({ data }) => {
            if (data.chartData) setChartData(data.chartData);
        }).catch(() => { });
    }, [fetchTickets]));

    const handleOpenScanner = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({ type: 'error', text1: 'Permission refusée', text2: 'Autorisez la caméra pour scanner' });
                return;
            }
        }
        setScannedTicket(null);
        setScannerOpen(true);
    };

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanning) return;
        setScanning(true);
        try {
            const ref = data.trim();
            const ticket = tickets.find(t => t.ref === ref);
            if (ticket) {
                setScannedTicket(ticket);
            } else {
                const { data: fetched } = await api.get<TicketData>(`/tickets/${ref}`).catch(() => ({ data: null }));
                if (fetched) {
                    setScannedTicket(fetched);
                } else {
                    Toast.show({ type: 'error', text1: 'Non trouvé', text2: `Aucune fiche avec réf: ${ref}` });
                }
            }
        } catch {
            Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de lire le QR code' });
        } finally {
            setScanning(false);
        }
    };

    const logoBase64Ref = useRef<string | null>(null);

    useEffect(() => {
        const logoUrl = ficheSettings?.['entreprise.logo'];
        if (logoUrl && !logoBase64Ref.current) {
            fetch(logoUrl)
                .then(r => r.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => { logoBase64Ref.current = reader.result as string; };
                    reader.readAsDataURL(blob);
                })
                .catch(() => { });
        }
    }, [ficheSettings?.['entreprise.logo']]);

    const buildReceiptHtml = async (ticket: TicketData) => {
        const s = ficheSettings;
        const showLogo = s['fiche.show_logo'] !== 'false' && s['entreprise.logo'];
        const showEntreprise = s['fiche.show_entreprise'] !== 'false';
        const showTel = s['fiche.show_tel'] !== 'false';
        const message = s['fiche.message'] || '';
        const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
        const timeStr = createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusLabel = ticket.status === 'gagne' ? 'GAGNÉ' : ticket.status === 'perdu' ? 'PERDU' : 'EN ATTENTE';
        const lignesHtml = ticket.lignes.map(l =>
            `<tr><td style="font-weight:700;letter-spacing:2px;font-family:monospace;font-size:13px">${l.numero}</td><td style="text-align:center">${l.type === 'lotto5' ? 'L5' : l.type === 'jackpot' ? 'JP' : 'L4'}</td><td style="text-align:center">${l.type === 'jackpot' ? '—' : l.option === 'opt1' ? 'Op1' : 'Op2'}</td><td style="text-align:right">${Number(l.prix).toLocaleString()}</td></tr>`
        ).join('');
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;width:58mm;margin:0 auto;padding:12px 8px;color:#1a1a1a;font-size:11px}.center{text-align:center}.logo{width:80px;height:80px;object-fit:contain;margin:0 auto 8px}.name{font-size:14px;font-weight:900;margin-bottom:2px}.sub{font-size:9px;color:#666;margin-bottom:2px}.divider{border-top:1px dashed #ccc;margin:8px 0}.row{display:flex;justify-content:space-between;margin-bottom:3px}.label{color:#666;font-size:10px}.val{font-weight:700;font-size:11px}table{width:100%;border-collapse:collapse;margin:4px 0}th{font-size:9px;text-transform:uppercase;color:#666;border-bottom:1px solid #ddd;padding:3px 0;text-align:left}td{padding:3px 0;font-size:11px}.total-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px}.total-label{font-size:11px;color:#666}.total-val{font-size:16px;font-weight:900}.msg{font-size:9px;color:#1a1a1a;text-align:center;margin-top:8px;font-style:italic}.time{font-size:8px;color:#1a1a1a;text-align:center;margin-top:6px}</style></head><body>
            <div class="center">${showLogo ? `<img src="${logoBase64Ref.current || s['entreprise.logo']}" class="logo"/>` : ''}${showEntreprise ? `<div class="name">${s['entreprise.nom'] || 'LDML'}</div><div class="sub">${s['entreprise.adresse'] || ''}</div>` : ''}${showTel ? `<div class="sub">Tél: ${s['entreprise.telephone'] || ''}</div>` : ''}</div>
            <div class="divider"></div>
            <div class="row"><span class="label">Réf.</span><span class="val">${ticket.ref}</span></div>
            <div class="row"><span class="label">Borlette</span><span class="val">${ticket.borlette}</span></div>
            <div class="row"><span class="label">Tirage</span><span class="val">${ticket.tirage}</span></div>
            <div class="row"><span class="label">Date</span><span class="val">${dateStr} à ${timeStr}</span></div>
            <div class="divider"></div>
            <table><thead><tr><th>Numéro</th><th style="text-align:center">Type</th><th style="text-align:center">Opt</th><th style="text-align:right">Prix</th></tr></thead><tbody>${lignesHtml}</tbody></table>
            <div class="divider"></div>
            <div class="total-row"><span class="total-label">${ticket.lignes.length} ligne(s)</span><span class="total-val">${Number(ticket.total).toLocaleString()} HTG</span></div>
            ${message ? `<div class="msg">${message}</div>` : ''}
            <div class="time">${ticket.ref} · ${dateStr} ${timeStr} · ${statusLabel}</div>
        </body></html>`;
    };

    const handleShareFiche = async (ticket: TicketData) => {
        try {
            const html = await buildReceiptHtml(ticket);
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        } catch { /* user cancelled */ }
    };

    const handleReplay = async (ticket: TicketData) => {
        const lignes = ticket.lignes.map((l, i) => ({
            id: i + 1,
            type: l.type,
            numero: l.numero,
            option: l.option,
            prix: String(l.prix),
        }));
        await saveDraftFiche({ borlette: '', tirage: '', lignes });
        router.push('/(tabs)/vendre' as any);
    };

    const filteredFiches = tickets.filter(f => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return f.ref.toLowerCase().includes(q) || f.date.includes(q) || f.borlette.toLowerCase().includes(q);
    });

    const counts = {
        total: tickets.length,
        en_attente: tickets.filter(t => t.status === 'en_attente').length,
        gagne: tickets.filter(t => t.status === 'gagne').length,
        perdu: tickets.filter(t => t.status === 'perdu').length,
    };

    const totalVentes = tickets.reduce((s, t) => s + Number(t.total), 0);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header />
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Stats grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Ventes | {counts.total} fiches</Text>
                        <Text style={styles.statValue}>{totalVentes.toLocaleString()} <Text style={styles.statCurrency}>HTG</Text></Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>En attente</Text>
                        <Text style={[styles.statValue, { color: Colors.gold }]}>{counts.en_attente}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Gagnés</Text>
                        <Text style={[styles.statValue, { color: Colors.green }]}>{counts.gagne}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Perdus</Text>
                        <Text style={[styles.statValue, { color: Colors.red }]}>{counts.perdu}</Text>
                    </View>
                </View>

                {/* Chart 7 jours */}
                {chartData.length > 0 && (() => {
                    const maxVal = Math.max(...chartData.map(d => d.total), 1);
                    return (
                        <View style={styles.chartSection}>
                            <Text style={styles.chartSectionTitle}>7 derniers jours</Text>
                            <View style={styles.chartBars}>
                                {chartData.map((d, i) => {
                                    const isToday = i === chartData.length - 1;
                                    return (
                                        <View key={d.label} style={styles.chartBarCol}>
                                            <Text style={styles.chartBarValue}>
                                                {d.total >= 10000 ? `${(d.total / 1000).toFixed(0)}k` : d.total > 0 ? d.total.toLocaleString() : '—'}
                                            </Text>
                                            <View style={styles.chartBarTrack}>
                                                <View style={[styles.chartBarFill, { height: `${Math.max((d.total / maxVal) * 100, 4)}%`, backgroundColor: isToday ? Colors.gold : Colors.gold + '60' }]} />
                                            </View>
                                            <Text style={[styles.chartBarLabel, isToday && { color: Colors.gold }]}>{d.label}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })()}

                {/* Mes fiches */}
                <View style={styles.chartCard}>
                    <View style={styles.fichesHeader}>
                        <Text style={styles.chartTitle}>Mes fiches</Text>
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            <Pressable style={styles.exportButton} onPress={handleOpenScanner}>
                                <ScanLine size={14} color={Colors.offWhite} />
                            </Pressable>
                            <Pressable style={styles.exportButton}>
                                <Text style={styles.exportButtonText}>Export</Text>
                            </Pressable>
                        </View>
                    </View>
                    <View style={styles.searchBar}>
                        <Search size={14} color={Colors.gray} />
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Réf, date ou borlette..."
                            placeholderTextColor={Colors.gray}
                        />
                    </View>

                    {loading ? (
                        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                            <ActivityIndicator color={Colors.gold} />
                        </View>
                    ) : filteredFiches.length === 0 ? (
                        <Text style={{ color: Colors.gray, textAlign: 'center', paddingVertical: 20, fontSize: 13 }}>
                            Aucune fiche trouvée
                        </Text>
                    ) : (() => {
                        let lastDate = '';
                        return filteredFiches.map((f, i) => {
                            const dateStr = formatDate(f.date);
                            const showDate = dateStr !== lastDate;
                            lastDate = dateStr;
                            const isOpen = expandedFiche === i;

                            const statusLabel = f.status === 'gagne' ? 'GAGNÉ' : f.status === 'perdu' ? 'PERDU' : 'EN ATTENTE';
                            const statusColor = f.status === 'gagne' ? Colors.green : f.status === 'perdu' ? Colors.red : Colors.gold;

                            return (
                                <View key={f.id}>
                                    {showDate && (
                                        <Text style={styles.ficheDateHeader}>{dateStr}</Text>
                                    )}
                                    <Pressable
                                        style={[styles.ficheRow, !showDate && styles.ficheRowBorder]}
                                        onPress={() => setExpandedFiche(isOpen ? null : i)}
                                    >
                                        <View style={styles.ficheInfo}>
                                            <Text style={styles.ficheType}>
                                                Fiche · {f.lignes.length} ligne{f.lignes.length > 1 ? 's' : ''}
                                            </Text>
                                            <Text style={styles.ficheTirage}>{f.ref} · {f.tirage} · {f.borlette}</Text>
                                        </View>
                                        <View style={styles.ficheRight}>
                                            <Text style={styles.ficheMontant}>{Number(f.total).toLocaleString()} <Text style={styles.ficheCurrency}>HTG</Text></Text>
                                            <Text style={[styles.ficheStatus, { color: statusColor }]}>{statusLabel}</Text>
                                        </View>
                                    </Pressable>
                                    {isOpen && (
                                        <View style={styles.ficheDetail}>
                                            <View style={styles.ficheDetailHeader}>
                                                <Text style={[styles.ficheDetailCol, { flex: 1 }]}>Numéro</Text>
                                                <Text style={[styles.ficheDetailCol, { width: 40 }]}>Type</Text>
                                                <Text style={[styles.ficheDetailCol, { width: 50 }]}>Opt</Text>
                                                <Text style={[styles.ficheDetailCol, { width: 60, textAlign: 'right' }]}>Prix</Text>
                                            </View>
                                            {f.lignes.map((l) => (
                                                <View key={l.id} style={styles.ficheDetailRow}>
                                                    <Text style={[styles.ficheDetailCell, { flex: 1, letterSpacing: 2, fontWeight: '700' }]}>{l.numero}</Text>
                                                    <Text style={[styles.ficheDetailCell, { width: 40 }]}>{l.type === 'jackpot' ? 'JP' : l.type === 'lotto5' ? 'L5' : 'L4'}</Text>
                                                    <Text style={[styles.ficheDetailCell, { width: 50 }]}>{l.type === 'jackpot' ? '—' : l.option === 'opt1' ? 'Opt 1' : 'Opt 2'}</Text>
                                                    <Text style={[styles.ficheDetailCell, { width: 60, textAlign: 'right' }]}>{Number(l.prix).toLocaleString()}</Text>
                                                </View>
                                            ))}
                                            <View style={styles.ficheActionRow}>
                                                <Pressable style={styles.ficheActionBtn} onPress={() => handleShareFiche(f)}>
                                                    <Share2 size={14} color={Colors.offWhite} />
                                                    <Text style={styles.ficheActionText}>Partager</Text>
                                                </Pressable>
                                                <Pressable style={styles.ficheActionBtnGold} onPress={() => handleReplay(f)}>
                                                    <RefreshCw size={14} color={Colors.navy} />
                                                    <Text style={styles.ficheActionTextGold}>Rejouer</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        });
                    })()}
                </View>

            </ScrollView>

            {/* Scanner Modal */}
            <Modal visible={scannerOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setScannerOpen(false)}>
                <View style={styles.scannerContainer}>
                    {!scannedTicket ? (
                        <View style={{ flex: 1 }}>
                            <View style={[styles.scannerHeader, { paddingTop: insets.top + 16 }]}>
                                <Text style={styles.scannerTitle}>Scanner une fiche</Text>
                                <Pressable onPress={() => setScannerOpen(false)} hitSlop={12}>
                                    <X size={24} color={Colors.offWhite} />
                                </Pressable>
                            </View>
                            <CameraView
                                style={styles.camera}
                                facing="back"
                                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                                onBarcodeScanned={scanning ? undefined : handleBarCodeScanned}
                            />
                            <Text style={styles.scannerHint}>Placez le QR code de la fiche dans le cadre</Text>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1 }}>
                            <View style={[styles.scannerHeader, { paddingTop: insets.top + 16 }]}>
                                <Text style={styles.scannerTitle}>Fiche {scannedTicket.ref}</Text>
                                <Pressable onPress={() => setScannerOpen(false)}>
                                    <X size={24} color={Colors.offWhite} />
                                </Pressable>
                            </View>
                            <View style={{ padding: Spacing.xl, gap: Spacing.md }}>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Réf.</Text>
                                    <Text style={styles.scanResultValue}>{scannedTicket.ref}</Text>
                                </View>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Borlette</Text>
                                    <Text style={styles.scanResultValue}>{scannedTicket.borlette}</Text>
                                </View>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Tirage</Text>
                                    <Text style={styles.scanResultValue}>{scannedTicket.tirage}</Text>
                                </View>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Date</Text>
                                    <Text style={styles.scanResultValue}>{formatDate(scannedTicket.date)}</Text>
                                </View>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Total</Text>
                                    <Text style={[styles.scanResultValue, { color: Colors.gold, fontWeight: '800' }]}>{Number(scannedTicket.total).toLocaleString()} HTG</Text>
                                </View>
                                <View style={styles.scanResultRow}>
                                    <Text style={styles.scanResultLabel}>Statut</Text>
                                    <Text style={[styles.scanResultValue, {
                                        color: scannedTicket.status === 'gagne' ? Colors.green : scannedTicket.status === 'perdu' ? Colors.red : Colors.gold,
                                        fontWeight: '800',
                                    }]}>
                                        {scannedTicket.status === 'gagne' ? 'GAGNÉ' : scannedTicket.status === 'perdu' ? 'PERDU' : 'EN ATTENTE'}
                                    </Text>
                                </View>

                                <View style={{ marginTop: Spacing.md }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm }}>
                                        Lignes ({scannedTicket.lignes.length})
                                    </Text>
                                    {scannedTicket.lignes.map((l) => (
                                        <View key={l.id} style={{ flexDirection: 'row', paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.navyMedium }}>
                                            <Text style={{ flex: 1, fontSize: 13, color: Colors.offWhite, fontWeight: '700', letterSpacing: 2 }}>{l.numero}</Text>
                                            <Text style={{ width: 35, fontSize: 12, color: Colors.gray }}>{l.type === 'jackpot' ? 'JP' : l.type === 'lotto5' ? 'L5' : 'L4'}</Text>
                                            <Text style={{ width: 50, fontSize: 12, color: Colors.gray, textAlign: 'right' }}>{Number(l.prix).toLocaleString()}</Text>
                                        </View>
                                    ))}
                                </View>

                                <Pressable style={styles.scanAgainButton} onPress={() => setScannedTicket(null)}>
                                    <ScanLine size={16} color={Colors.navy} />
                                    <Text style={styles.scanAgainText}>Scanner une autre</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    )}
                </View>
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
        gap: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    statCard: {
        width: '47%',
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.gray,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.white,
        fontVariant: ['tabular-nums'],
    },
    statCurrency: {
        fontSize: 8,
        fontWeight: '700',
    },
    chartCard: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    chartTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.offWhite,
        marginBottom: Spacing.lg,
    },
    ficheDateHeader: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.gold,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },
    fichesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    exportButton: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    exportButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        marginBottom: Spacing.md,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: Colors.offWhite,
    },
    ficheRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    ficheRowBorder: {
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    ficheInfo: {
        flex: 1,
    },
    ficheType: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    ficheTirage: {
        fontSize: 12,
        color: Colors.gray,
        marginTop: 2,
    },
    ficheRight: {
        alignItems: 'flex-end',
    },
    ficheMontant: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    ficheCurrency: {
        fontSize: 9,
        fontWeight: '700',
    },
    ficheStatus: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
    },
    ficheDetail: {
        backgroundColor: Colors.navyMedium,
        borderRadius: Radius.sm,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    ficheDetailHeader: {
        flexDirection: 'row',
        marginBottom: Spacing.xs,
    },
    ficheDetailCol: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    ficheDetailRow: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    ficheDetailCell: {
        fontSize: 12,
        color: Colors.offWhite,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    scannerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.offWhite,
    },
    camera: {
        flex: 1,
        marginHorizontal: Spacing.xl,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    scannerHint: {
        textAlign: 'center',
        color: Colors.gray,
        fontSize: 13,
        padding: Spacing.xl,
    },
    scanResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.navyMedium,
    },
    scanResultLabel: {
        fontSize: 13,
        color: Colors.gray,
    },
    scanResultValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    scanAgainButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.gold,
        borderRadius: Radius.md,
        paddingVertical: Spacing.lg,
        marginTop: Spacing.xl,
    },
    scanAgainText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.navy,
    },
    ficheActionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.navyLight,
        paddingTop: Spacing.md,
    },
    ficheActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.navyLight,
        borderRadius: Radius.sm,
    },
    ficheActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    ficheActionBtnGold: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.gold,
        borderRadius: Radius.sm,
    },
    ficheActionTextGold: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.navy,
    },
    chartSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.lg,
    },
    chartSectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.gray,
        width: 50,
    },
    chartBars: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        height: 80,
    },
    chartBarCol: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    chartBarValue: {
        fontSize: 8,
        fontWeight: '700',
        color: Colors.gray,
        fontVariant: ['tabular-nums'],
    },
    chartBarTrack: {
        width: '100%',
        height: 46,
        backgroundColor: Colors.navyMedium,
        borderRadius: 3,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    chartBarFill: {
        width: '100%',
        borderRadius: 3,
    },
    chartBarLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: Colors.gray,
    },
});
